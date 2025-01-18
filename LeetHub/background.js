import { Octokit } from './lib/octokit.js';
import { config } from './config.js';

const CLIENT_ID = config.CLIENT_ID;
const CLIENT_SECRET = config.CLIENT_SECRET;
const REDIRECT_URL = chrome.identity.getRedirectURL();
const GITHUB_SCOPE = 'read:user repo';

console.log('Background script loaded');
console.log('Client ID:', CLIENT_ID);
console.log('Redirect URL:', REDIRECT_URL);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    if (request.action === 'authenticate') {
        (async () => {
            try {
                console.log('Starting authentication...');
                const token = await initiateOAuth();
                console.log('Received token:', !!token);
                
                if (token) {
                    await chrome.storage.sync.set({ 'github_token': token });
                    console.log('Token stored successfully');
                    
                    const octokit = new Octokit({ auth: token });
                    const { data: userData } = await octokit.request('GET /user');
                    console.log('GitHub auth successful for user:', userData.login);
                    
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
        console.log("Received completed message:", request);
        createFiles(request.answer, request.title, request.question)
            .then(result => {
                console.log("Upload result:", result);
                sendResponse(result);
            })
            .catch(error => {
                console.error("Upload error:", error);
                sendResponse({ success: false, message: error.message });
            });
        return true;
    }
});

async function initiateOAuth() {
    try {
        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.append('client_id', CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URL);
        authUrl.searchParams.append('scope', GITHUB_SCOPE);
        
        console.log('Starting OAuth flow with URL:', authUrl.toString());
        
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });
        
        console.log('Received redirect URL');
        
        const responseUrl = new URL(redirectUrl);
        const code = responseUrl.searchParams.get('code');
        
        if (!code) {
            throw new Error('No authorization code received');
        }
        
        console.log('Exchanging code for token...');
        
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URL
            })
        });
        
        if (!tokenResponse.ok) {
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }
        
        const data = await tokenResponse.json();
        console.log('Token exchange response:', data);
        
        if (data.error) {
            throw new Error(`GitHub error: ${data.error_description || data.error}`);
        }
        
        if (!data.access_token) {
            throw new Error('No access token in response');
        }
        
        return data.access_token;
    } catch (error) {
        console.error('OAuth flow error:', error);
        throw error;
    }
}

async function createFiles(answer, title, question) {
    try {
        console.log("Starting file creation process...");
        console.log("Title:", title);
        
        const data = await chrome.storage.sync.get('github_token');
        if (!data.github_token) {
            console.error('No GitHub token found');
            throw new Error('GitHub token not found');
        }

        console.log("Token found, initializing Octokit...");
        const octokit = new Octokit({ auth: data.github_token });

        console.log("Fetching user data...");
        const { data: userData } = await octokit.request('GET /user');
        console.log("User authenticated as:", userData.login);

        // First check if the question folder exists
        try {
            await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: userData.login,
                repo: 'LeetCode-Questions',
                path: title
            });
            // If we get here, the folder exists
            return { success: false, message: "This question already exists in your repository!" };
        } catch (error) {
            // 404 means the folder doesn't exist, which is what we want
            if (error.status !== 404) {
                throw error;
            }
        }

        const commitMessage = `Added ${title} to LeetCode Questions`;
        const paths = [`${title}/answer.txt`, `${title}/question.txt`];
        const contents = [answer, question];

        // Create both files
        for (let i = 0; i < paths.length; i++) {
            await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                owner: userData.login,
                repo: 'LeetCode-Questions',
                path: paths[i],
                message: commitMessage,
                content: utf8_to_b64(contents[i])
            });
            console.log(`Successfully created ${paths[i]}`);
        }

        return { success: true, message: "Successfully uploaded to GitHub!" };
    } catch (error) {
        console.error("Error in createFiles:", error);
        if (error.status === 404 && error.message.includes('Not Found')) {
            return { 
                success: false, 
                message: "Repository 'LeetCode-Questions' not found. Please create it first!" 
            };
        }
        return { 
            success: false, 
            message: `Upload failed: ${error.message}`
        };
    }
}

function utf8_to_b64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error("Encoding error:", e);
        throw new Error("Failed to encode content");
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