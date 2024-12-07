import { Octokit } from 'https://cdn.skypack.dev/@octokit/core';
const CLIENT_ID = 'Ov23liptpDF1fVaezjUB';
const REDIRECT_URL = chrome.identity.getRedirectURL();
const GITHUB_SCOPE = 'read:user repo'; // Adjust scopes as needed

//MESSAGE LISTENER
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate') {
        handleAuthentication(sendResponse);
        checkRepo();
        return true;
    } else if (request.type === 'completed') {
        createFiles(request.answer, request.title, request.question);
        sendResponse({message : "Succesfully uploaded to github"})
        return true; 
    }
});

//REPO STUFF
async function checkRepo() {
    try {
        const data = await chrome.storage.sync.get('github_token');
        const token = data.github_token;
 
        if (!token) {
            console.log('Token not found');
            return;
        }
 
        const octokit = new Octokit({ auth: token });
        
        // Get user data first
        const { data: userData } = await octokit.request('GET /user');
        const username = userData.login;
 
        try {
            // Check if repo exists
            await octokit.request('GET /repos/{owner}/{repo}', {
                owner: username,
                repo: 'LeetCode-Questions'
            });
            console.log('Repository exists');
        } catch (error) {
            if (error.status === 404) {
                // Create repo if it doesn't exist
                await octokit.request('POST /user/repos', {
                    name: 'LeetCode-Questions',
                    description: 'My LeetCode solutions and explanations',
                    private: false,
                    auto_init: true
                });
                console.log('Repository created');
            }
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
 }

 async function createFiles(answer, title, question) {
    try {
        console.log("Creating files")
        const data = await chrome.storage.sync.get('github_token');
        const token = data.github_token;
        if (!token) throw new Error('GitHub token not found');

        const octokit = new Octokit({ auth: token });
        const { data: userData } = await octokit.request('GET /user');

        const commitMessage = `Added ${title} to LeetCode Questions`;
        const paths = [`${title}/answer.txt`, `${title}/question.txt`];
        const contents = [answer, question];

        for (let i = 0; i < paths.length; i++) {
            try {
                // Check if file exists
                await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                    owner: userData.login,
                    repo: 'LeetCode-Questions',
                    path: paths[i]
                });
                console.log(`File ${paths[i]} already exists, skipping...`);
                continue;
            } catch (error) {
                if (error.status === 404) {
                    // File doesn't exist, create it
                    console.log("File doenst exist, creating...")
                    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                        owner: userData.login,
                        repo: 'LeetCode-Questions',
                        path: paths[i],
                        message: commitMessage,
                        content: utf8_to_b64(contents[i])
                    });
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error("Error creating files:", error);
        throw error;
    }
}

//Converting to base 64 
function utf8_to_b64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

//USER AUTHENTICATION
async function handleAuthentication(sendResponse) {
    try {
        const token = await initiateOAuth();
        sendResponse({ token });
    } catch (error) {
        sendResponse({ error: error.message });
    }
}

async function initiateOAuth() {
    const authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}` +
        `&scope=${encodeURIComponent(GITHUB_SCOPE)}`;

    try {
        // Launch the auth flow
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        // Extract the token from the redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');

        // Exchange code for token using GitHub's OAuth token endpoint
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
                code: code,
            })
        });
        const data = await tokenResponse.json();
        console.log("Got data ", data);
        return data.access_token;
    } catch (error) {
        throw new Error('Failed to authenticate with GitHub');
    }
}
