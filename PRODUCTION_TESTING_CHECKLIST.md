# AI Feature Production Testing Checklist

## Pre-Deployment Verification

- [x] AI cleaning API endpoint created (`/api/ai/clean`)
- [x] Backend saves cleaned data to KV and D1
- [x] Frontend button added to BookDetailModal
- [x] Error handling implemented
- [x] Caching strategy in place (30-day TTL)
- [x] Code committed and pushed to main

## Deployment Steps

- [ ] GitHub repository connected to Cloudflare Pages
- [ ] Build settings configured (see CLOUDFLARE_DEPLOYMENT.md)
- [ ] Environment variable `GOOGLE_AI_API_KEY` set
- [ ] D1 database binding configured (DB → rangkai-scans)
- [ ] KV namespace binding configured (BOOK_CACHE → 0844494af5e74ac1b28600f686a060c2)
- [ ] Automatic deployment triggered from main branch
- [ ] Deployment completed successfully

## Post-Deployment Testing

### 1. Basic Functionality Test
- [ ] Visit production URL
- [ ] Login with GitHub OAuth (if configured)
- [ ] Navigate to scanner or search

### 2. AI Cleaning Feature Test
- [ ] Scan a book with ISBN (e.g., 9780134685991)
- [ ] Open book details modal
- [ ] Verify "Clean with AI" button is visible
- [ ] Click "Clean with AI" button
- [ ] Verify loading state appears
- [ ] Verify cleaned metadata is displayed
- [ ] Verify cleaned data is saved (reload and check)

### 3. Edge Cases
- [ ] Test with invalid ISBN
- [ ] Test with book not in Google Books
- [ ] Test without AI API key (should show error)
- [ ] Test rate limiting behavior
- [ ] Test cache hit (clean same book twice)

### 4. Performance Testing
- [ ] Measure initial load time
- [ ] Measure API response time (first call)
- [ ] Measure API response time (cached)
- [ ] Check network waterfall in DevTools

## Monitoring Checklist

### Day 1: Initial Monitoring
- [ ] Check deployment logs for errors
- [ ] Verify AI API calls are working
- [ ] Monitor error rates in Cloudflare Analytics
- [ ] Check Google AI API usage quota

### Week 1: Usage Patterns
- [ ] Review total AI cleaning requests
- [ ] Identify most cleaned books
- [ ] Check cache hit rate
- [ ] Monitor API costs

### Ongoing Monitoring
- [ ] Set up Cloudflare alerts for high error rates
- [ ] Monitor Google AI quota usage weekly
- [ ] Review user feedback
- [ ] Track feature adoption rate

## Rate Limits & Quotas

### Google AI API (Free Tier)
- **Requests per minute**: 60 RPM
- **Requests per day**: 1,500 RPD
- **Tokens per minute**: 32,000 TPM

### Mitigation Strategies
1. **Caching**: 30-day KV cache reduces repeat requests
2. **Debouncing**: Button has 2-second cooldown
3. **Error handling**: Graceful fallback to original data
4. **User messaging**: Clear indication of rate limits

## Troubleshooting

### API Key Issues
```bash
# Verify environment variable is set
wrangler pages deployment list --project-name=rangkai-book-metadata
# Check Settings → Environment variables in dashboard
```

### Build Failures
```bash
# Test build locally
npm run build
# Check for errors in local build
```

### Runtime Errors
```bash
# Tail production logs
wrangler pages deployment tail --project-name=rangkai-book-metadata
```

### D1/KV Access Issues
```bash
# Verify D1 binding
wrangler d1 execute rangkai-scans --command="SELECT * FROM scans LIMIT 1"

# Verify KV binding
wrangler kv:key list --namespace-id=0844494af5e74ac1b28600f686a060c2
```

## Success Criteria

✅ Deployment successful without errors
✅ AI cleaning feature works in production
✅ Cleaned data persists correctly
✅ Cache reduces API calls
✅ Error handling works gracefully
✅ Response times acceptable (<3s for AI calls)
✅ No critical errors in first 24 hours

## Next Steps After Successful Deployment

1. **Documentation**: Update README with AI feature
2. **User Guide**: Create help documentation
3. **Analytics**: Track feature usage
4. **Optimization**: Consider batch cleaning for imports
5. **Scaling**: Monitor and plan for growth

## Quick Reference

**Production URL**: `https://rangkai-book-metadata.pages.dev`
**Dashboard**: [Cloudflare Pages](https://dash.cloudflare.com/)
**Google AI**: [AI Studio](https://aistudio.google.com/)
**Logs**: Run `./monitor-ai-production.sh`
