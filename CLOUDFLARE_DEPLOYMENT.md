# Cloudflare Pages Deployment Guide

## Prerequisites

- GitHub repository: `missmuthi/rangkai-book-metadata`
- Cloudflare account with Pages access
- D1 database: `rangkai-scans` (ID: c3d6dcc2-e7b8-4537-8b23-67d8921b3233)
- KV namespace: `BOOK_CACHE` (ID: 0844494af5e74ac1b28600f686a060c2)

## Step 1: Connect GitHub to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Pages**
3. Click **Create Application** → **Connect to Git**
4. Select your GitHub account and authorize Cloudflare
5. Select repository: `missmuthi/rangkai-book-metadata`

## Step 2: Configure Build Settings

Set up the build configuration:

- **Production branch**: `main`
- **Build command**: `npm run build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Root directory**: `/` (leave empty)
- **Node version**: 18 or higher

## Step 3: Set Environment Variables

In the Cloudflare Pages dashboard for your project:

1. Go to **Settings** → **Environment variables**
2. Add the following variables for **Production**:

### Required Variables

```
GOOGLE_AI_API_KEY=<your-google-ai-api-key>
```

### Optional Variables (if not using GitHub OAuth)

```
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
AUTH_SECRET=<random-secret-for-auth-sessions>
```

**Note**: You can generate AUTH_SECRET with:

```bash
openssl rand -base64 32
```

## Step 4: Bind D1 and KV Resources

1. Go to **Settings** → **Functions**
2. Under **Bindings**, add:

### D1 Database Binding

- **Variable name**: `DB`
- **D1 database**: Select `rangkai-scans`

### KV Namespace Binding

- **Variable name**: `BOOK_CACHE`
- **KV namespace**: Select the KV namespace with ID `0844494af5e74ac1b28600f686a060c2`

## Step 5: Deploy

Once configured, Cloudflare Pages will automatically:

1. Deploy on every push to `main` branch
2. Create preview deployments for pull requests
3. Run the build command and deploy the output

To trigger the first deployment:

```bash
git push origin main
```

## Step 6: Verify Deployment

1. Check deployment status in Cloudflare Pages dashboard
2. Visit your production URL (e.g., `https://rangkai-book-metadata.pages.dev`)
3. Test the AI cleaning feature:
   - Scan or search for a book
   - Open book details
   - Click "Clean with AI" button
   - Verify the metadata is cleaned and saved

## Step 7: Monitor AI Usage

### Check Google AI API Usage

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Navigate to API settings
3. Monitor your request count and rate limits

### Cloudflare Analytics

1. In Cloudflare Pages dashboard
2. Go to **Analytics** tab
3. Monitor:
   - Page views
   - Function invocations
   - Error rates

### Check Logs

```bash
# View recent logs
wrangler pages deployment tail

# View specific deployment logs
wrangler pages deployment tail --project-name=rangkai-book-metadata
```

## Troubleshooting

### Build Failures

- Check build logs in Cloudflare dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

### Environment Variable Issues

- Ensure `GOOGLE_AI_API_KEY` is set correctly
- Check for typos in variable names
- Verify API key is active in Google AI Studio

### D1/KV Binding Issues

- Ensure bindings are correctly configured
- Check database ID matches `wrangler.toml`
- Verify KV namespace exists and ID is correct

### AI API Rate Limits

- Google AI has rate limits (default: 60 requests/minute)
- Implement caching to reduce API calls
- Consider upgrading to paid tier if needed

## Production Best Practices

1. **API Key Security**
   - Never commit API keys to git
   - Use environment variables only
   - Rotate keys periodically

2. **Caching Strategy**
   - AI cleaned results are cached in KV
   - Cache TTL: 30 days (configurable)
   - Reduces API calls and costs

3. **Error Handling**
   - API failures return original data
   - User-friendly error messages
   - Logging for debugging

4. **Monitoring**
   - Set up alerts for high error rates
   - Monitor AI API quota usage
   - Track response times

## Next Steps

- [ ] Deploy to production
- [ ] Test AI feature in production
- [ ] Monitor initial usage patterns
- [ ] Set up custom domain (optional)
- [ ] Configure additional environment variables as needed

## Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Google AI API Docs](https://ai.google.dev/docs)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
