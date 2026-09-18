const axios = require('axios');

function normalizeUrl(input) {
  try {
    return new URL(input).toString();
  } catch (e) {
    return null;
  }
}

async function probeUrl(url) {
  const opts = { maxRedirects: 5, timeout: 8000, validateStatus: () => true };

  // HEAD first
  try {
    const head = await axios.head(url, opts);
    return { resp: head, method: 'HEAD' };
  } catch (err) {
    // Fallback to GET
  }

  try {
    const get = await axios.get(url, { ...opts, responseType: 'text' });
    return { resp: get, method: 'GET' };
  } catch (err) {
    return { error: err };
  }
}

function inspectHtmlForAccessIssues(html) {
  if (!html) return false;
  const lower = html.slice(0, 8000).toLowerCase();
  const blockedPhrases = [
    'access denied', 'you need permission', 'sign in', 'sign-in', 'log in', 'please sign in', '403', '404', 'not found', 'file not found', 'you don\'t have access'
  ];
  return blockedPhrases.some(p => lower.includes(p));
}

async function checkUrlAccessible(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, reason: 'invalid_url' };

  // If link looks like a Google Drive or Dropbox share link, generate direct-download candidates
  const candidates = [url];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Google Drive share links
    if (host.includes('drive.google.com')) {
      // examples: /file/d/FILEID/view or /open?id=FILEID
      const fileIdMatch = url.match(/(?:\/file\/d\/|\?id=)([a-zA-Z0-9_-]{10,})/);
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1];
        candidates.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
        candidates.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`); // sometimes helps
      }
    }

    // Dropbox share links: change ?dl=0 to dl=1 or append
    if (host.includes('dropbox.com')) {
      if (parsed.searchParams.get('dl') === '0' || parsed.pathname.includes('/s/')) {
        const dropboxDirect = url.replace('?dl=0', '?dl=1');
        if (!candidates.includes(dropboxDirect)) candidates.push(dropboxDirect);
        const dropboxAlt = url + (parsed.search ? '&dl=1' : '?dl=1');
        if (!candidates.includes(dropboxAlt)) candidates.push(dropboxAlt);
      }
    }
  } catch (err) {
    // ignore parse errors and proceed with original url
  }

  // Try each candidate until one looks accessible
  for (const candidate of candidates) {
    const probe = await probeUrl(candidate);
    if (probe.error) continue;

    const res = probe.resp;
    const status = res.status;
    const contentType = (res.headers && res.headers['content-type']) ? res.headers['content-type'] : '';

    // Try to detect sign-in/login redirects by inspecting the final response URL (axios leaves it on request.res.responseUrl)
    const finalUrl = (res.request && res.request.res && res.request.res.responseUrl) ? String(res.request.res.responseUrl).toLowerCase() : String(candidate).toLowerCase();
    if (finalUrl.includes('accounts.google.com') || finalUrl.includes('/signin') || finalUrl.includes('service=login') || finalUrl.includes('/servicelogin') || finalUrl.includes('interactivelogin')) {
      // Looks like a provider login redirect — treat as inaccessible and try next candidate
      continue;
    }

    if (status >= 400) continue; // try next candidate

    // If contentType indicates a file (pdf/zip/msword etc), do an extra HEAD without following redirects to detect sign-in redirects
    if (contentType && !contentType.includes('text/html')) {
      if (candidate.includes('cloudinary.com')) {
        return { ok: true, status: status || 200, contentType, candidate };
      }
      try {
        const headNoRedirect = await axios.head(candidate, { maxRedirects: 0, timeout: 4000, validateStatus: () => true });
        const loc = headNoRedirect.headers && headNoRedirect.headers.location ? headNoRedirect.headers.location.toLowerCase() : '';
        if (loc && (loc.includes('accounts.google.com') || loc.includes('/service/login') || loc.includes('/service/wise') || loc.includes('login'))) {
          // Candidate redirects to login flow — treat as restricted and try next candidate
          continue;
        }
      } catch (err) {
        // Safe fallback if head probe fails for non-HTML media files
      }

      return { ok: true, status: status || 200, contentType, candidate };
    }

    // If HTML, fetch body (if we used HEAD) to inspect for login/access issues
    let body = '';
    if (probe.method === 'GET') {
      body = typeof res.data === 'string' ? res.data : '';
    } else {
      try {
        const getResp = await axios.get(candidate, { maxRedirects: 5, timeout: 8000, responseType: 'text', validateStatus: () => true });
        body = typeof getResp.data === 'string' ? getResp.data : '';
      } catch (err) {
        continue; // cannot inspect this candidate
      }
    }

    // Check for known access restriction phrases
    const hasBlocked = inspectHtmlForAccessIssues(body);
    if (hasBlocked) continue; // try next candidate

    // Special-case: Google Drive may return an HTML preview but still be accessible for download; try direct download candidate if not already tried
    if (candidate.includes('drive.google.com') && !candidate.includes('uc?export=download')) {
      // if we haven't tried uc?export=download yet, it should have been in candidates earlier; skip here
    }

    // If we get here, assume the HTML page is public (e.g., Drive preview) and therefore accessible
    return { ok: true, status, contentType, candidate };
  }

  return { ok: false, reason: 'no_candidate_accessible' };
}

module.exports = { checkUrlAccessible };
