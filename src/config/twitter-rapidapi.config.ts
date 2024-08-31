import { registerAs } from '@nestjs/config';

export default registerAs('TWITTER_RAPIDAPI', () => ({
  apiKey:
    process.env.X_RAPIDAPI_KEY ||
    '66f2b9ba67msh58d61d6e135585bp10acb9jsnd19ea7132719',
}));
