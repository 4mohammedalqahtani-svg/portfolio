Netlify deployment notes
========================

This portfolio includes the AI chat as a Netlify Function:
  netlify/functions/chat.js

The project also includes netlify.toml so Netlify explicitly deploys the functions directory.

Before testing the AI, add this environment variable in Netlify:
  ANTHROPIC_API_KEY = your Anthropic API key

Optional:
  ANTHROPIC_MODEL = claude-sonnet-4-6

After adding/changing environment variables, create a new production deploy.
Do not put the API key inside index.html or any public file.
