import { HttpStatus, INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { OpenAPIObject } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { IS_PUBLIC_ENDPOINT } from '../decorator/public.decorator';
import { TOO_MANY_REQUESTS_MESSAGE } from '../guard/client-address-throttler.guard';

const ERROR_SCHEMA_REF = `#/components/schemas/${ErrorResponseDto.name}`;

const GENERIC_ERRORS: Record<string, string> = {
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '429': 'Too Many Requests',
  '500': 'Internal Server Error',
};

// Routes without parameters or a body still reject unknown query keys
// (UndeclaredQueryGuard is global).
const UNKNOWN_QUERY_ERROR = 'Bad Request: unknown query parameter';

type OperationObject = {
  operationId?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, { description?: string; content?: any }>;
};

// Operation ids are `<Controller>_<handler>`. The global JWT guard skips a
// handler only when it or its controller carries @Public(); a handler or
// controller guarded by a ThrottlerGuard can answer 429.
function operationIdsByGuard(app: INestApplication): {
  publicIds: Set<string>;
  throttledIds: Set<string>;
} {
  const reflector = app.get(Reflector);
  const publicIds = new Set<string>();
  const throttledIds = new Set<string>();
  const throttled = (target: object) =>
    (Reflect.getMetadata(GUARDS_METADATA, target) ?? []).some(
      (guard: any) => guard?.prototype instanceof ThrottlerGuard,
    );
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as any;
      if (!controller?.prototype) {
        continue;
      }
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') {
          continue;
        }
        const isPublic = reflector.getAllAndOverride<boolean>(
          IS_PUBLIC_ENDPOINT,
          [handler, controller],
        );
        if (isPublic) {
          publicIds.add(`${controller.name}_${name}`);
        }
        if (throttled(handler) || throttled(controller)) {
          throttledIds.add(`${controller.name}_${name}`);
        }
      }
    }
  }
  return { publicIds, throttledIds };
}

function messagesOf(value: any): string[] {
  const message = value?.responseMessage ?? value?.message;
  if (Array.isArray(message)) {
    return message.map(String);
  }
  return message ? [String(message)] : [];
}

// `NOT_FOUND` -> `Not Found`, for statuses without a generic description.
function reasonPhrase(status: string): string {
  const name = HttpStatus[Number(status)];
  if (!name) return '';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// The exception filter sends `error` as the HttpStatus name, so examples are
// rebuilt with that value rather than the reason phrase.
function errorExample(status: string, messages: string[]) {
  const error = HttpStatus[Number(status)] ?? 'INTERNAL_SERVER_ERROR';
  return {
    statusCode: Number(status),
    error,
    responseMessage: messages[0] ?? error,
  };
}

function errorContent(status: string, description: string, existing?: any) {
  const json = existing?.['application/json'];
  if (json?.examples) {
    const examples = Object.fromEntries(
      Object.entries(json.examples).map(([name, entry]: [string, any]) => [
        name,
        { ...entry, value: errorExample(status, messagesOf(entry.value)) },
      ]),
    );
    return {
      'application/json': { schema: { $ref: ERROR_SCHEMA_REF }, examples },
    };
  }
  const fallback = messagesOf(json?.schema?.example);
  return {
    'application/json': {
      schema: { $ref: ERROR_SCHEMA_REF },
      example: errorExample(
        status,
        fallback.length ? fallback : description ? [description] : [],
      ),
    },
  };
}

// Gives every operation the same documented error body: each 4xx/5xx response
// references ErrorResponseDto, every request can fail validation (400, if
// only for an unknown query parameter), protected routes can reject the token
// (401), rate-limited routes can refuse (429), and anything can fail
// unexpectedly (500).
export function documentErrorResponses(
  app: INestApplication,
  document: OpenAPIObject,
) {
  const { publicIds, throttledIds } = operationIdsByGuard(app);
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as OperationObject[]) {
      if (!operation?.responses) {
        continue;
      }
      const responses = operation.responses;
      const hasInput =
        (operation.parameters?.length ?? 0) > 0 || !!operation.requestBody;
      responses['400'] ??= {
        description: hasInput ? GENERIC_ERRORS['400'] : UNKNOWN_QUERY_ERROR,
      };
      const required = ['500'];
      if (!publicIds.has(operation.operationId ?? '')) {
        required.push('401');
      }
      if (throttledIds.has(operation.operationId ?? '')) {
        responses['429'] ??= {
          description: GENERIC_ERRORS['429'],
          content: {
            'application/json': {
              schema: {
                example: { responseMessage: TOO_MANY_REQUESTS_MESSAGE },
              },
            },
          },
        };
      }
      for (const status of required) {
        responses[status] ??= { description: GENERIC_ERRORS[status] };
      }
      for (const [status, response] of Object.entries(responses)) {
        if (Number(status) >= 400) {
          response.description ||=
            GENERIC_ERRORS[status] ?? reasonPhrase(status);
          response.content = errorContent(
            status,
            response.description,
            response.content,
          );
        }
      }
    }
  }
  return document;
}
