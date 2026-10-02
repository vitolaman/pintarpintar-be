import { HttpStatus, INestApplication } from '@nestjs/common';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { OpenAPIObject } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { IS_PUBLIC_ENDPOINT } from '../decorator/public.decorator';

const ERROR_SCHEMA_REF = `#/components/schemas/${ErrorResponseDto.name}`;

const GENERIC_ERRORS: Record<string, string> = {
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '500': 'Internal Server Error',
};

type OperationObject = {
  operationId?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, { description?: string; content?: any }>;
};

// Operation ids are `<Controller>_<handler>`; the global JWT guard skips a
// handler only when it or its controller carries @Public().
function publicOperationIds(app: INestApplication): Set<string> {
  const reflector = app.get(Reflector);
  const ids = new Set<string>();
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
          ids.add(`${controller.name}_${name}`);
        }
      }
    }
  }
  return ids;
}

function messagesOf(value: any): string[] {
  const message = value?.responseMessage ?? value?.message;
  if (Array.isArray(message)) {
    return message.map(String);
  }
  return message ? [String(message)] : [];
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
// references ErrorResponseDto, any request with input can fail validation
// (400), protected routes can reject the token (401), and anything can fail
// unexpectedly (500).
export function documentErrorResponses(
  app: INestApplication,
  document: OpenAPIObject,
) {
  const publicIds = publicOperationIds(app);
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as OperationObject[]) {
      if (!operation?.responses) {
        continue;
      }
      const responses = operation.responses;
      const hasInput =
        (operation.parameters?.length ?? 0) > 0 || !!operation.requestBody;
      const required = ['500'];
      if (hasInput) {
        required.push('400');
      }
      if (!publicIds.has(operation.operationId ?? '')) {
        required.push('401');
      }
      for (const status of required) {
        responses[status] ??= { description: GENERIC_ERRORS[status] };
      }
      for (const [status, response] of Object.entries(responses)) {
        if (Number(status) >= 400) {
          response.description ||= GENERIC_ERRORS[status] ?? '';
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
