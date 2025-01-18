import { config } from './config.js';

const CLIENT_ID = config.CLIENT_ID;
const CLIENT_SECRET = config.CLIENT_SECRET;
const REDIRECT_URL = chrome.identity.getRedirectURL();
const GITHUB_SCOPE = 'read:user repo';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
   if (request.action === 'authenticate') {
       (async () => {
           try {
               const token = await initiateOAuth();
               if (token) {
                   await chrome.storage.sync.set({ 'github_token': token });
                   const userData = await getUser(token);
                   sendResponse({ token, success: true });
               } else {
                   throw new Error('No token received');
               }
           } catch (error) {
               console.error('Auth error:', error);
               sendResponse({ error: error.message, success: false });
           }
       })();
       return true;
   } else if (request.type === 'completed') {
       createFiles(request.answer, request.title, request.question)
           .then(result => sendResponse(result))
           .catch(error => sendResponse({ success: false, message: error.message }));
       return true;
   }
});

async function initiateOAuth() {
   try {
       const authUrl = new URL('https://github.com/login/oauth/authorize');
       authUrl.searchParams.append('client_id', CLIENT_ID);
       authUrl.searchParams.append('redirect_uri', REDIRECT_URL);
       authUrl.searchParams.append('scope', GITHUB_SCOPE);
       
       const redirectUrl = await chrome.identity.launchWebAuthFlow({
           url: authUrl.toString(),
           interactive: true
       });
       
       const code = new URL(redirectUrl).searchParams.get('code');
       if (!code) throw new Error('No authorization code received');
       
       const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
           method: 'POST',
           headers: {
               'Accept': 'application/json',
               'Content-Type': 'application/json',
           },
           body: JSON.stringify({
               client_id: CLIENT_ID,
               client_secret: CLIENT_SECRET,
               code,
               redirect_uri: REDIRECT_URL
           })
       });
       
       const data = await tokenResponse.json();
       if (data.error) throw new Error(`GitHub error: ${data.error_description || data.error}`);
       if (!data.access_token) throw new Error('No access token in response');
       
       return data.access_token;
   } catch (error) {
       console.error('OAuth flow error:', error);
       throw error;
   }
}

async function getUser(token) {
   const response = await fetch('https://api.github.com/user', {
       headers: {
           'Authorization': `token ${token}`,
           'Accept': 'application/vnd.github.v3+json'
       }
   });
   return response.json();
}

async function createFiles(answer, title, question) {
   try {
       const data = await chrome.storage.sync.get('github_token');
       if (!data.github_token) throw new Error('GitHub token not found');

       const userData = await getUser(data.github_token);
       const headers = {
           'Authorization': `token ${data.github_token}`,
           'Accept': 'application/vnd.github.v3+json',
           'Content-Type': 'application/json'
       };

       // Check if folder exists
       try {
           const checkResponse = await fetch(
               `https://api.github.com/repos/${userData.login}/LeetCode-Questions/contents/${title}`,
               { headers }
           );
           if (checkResponse.ok) {
               return { success: false, message: "This question already exists in your repository!" };
           }
       } catch (error) {
           if (error.status !== 404) throw error;
       }

       const paths = [`${title}/answer.txt`, `${title}/question.txt`];
       const contents = [answer, question];

       for (let i = 0; i < paths.length; i++) {
           await fetch(
               `https://api.github.com/repos/${userData.login}/LeetCode-Questions/contents/${paths[i]}`,
               {
                   method: 'PUT',
                   headers,
                   body: JSON.stringify({
                       message: `Added ${title} to LeetCode Questions`,
                       content: btoa(unescape(encodeURIComponent(contents[i])))
                   })
               }
           );
       }

       return { success: true, message: "Successfully uploaded to GitHub!" };
   } catch (error) {
       if (error.status === 404) {
           return { success: false, message: "Repository 'LeetCode-Questions' not found. Please create it first!" };
       }
       return { success: false, message: `Upload failed: ${error.message}` };
   }
}

chrome.runtime.onInstalled.addListener(async () => {
   try {
       const data = await chrome.storage.sync.get('github_token');
       console.log('Storage check on install:', data);
   } catch (error) {
       console.error('Storage check error:', error);
   }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
   if (namespace === 'sync' && changes.github_token) {
       console.log('Token storage changed:', {
           oldValue: !!changes.github_token.oldValue,
           newValue: !!changes.github_token.newValue
       });
   }
});