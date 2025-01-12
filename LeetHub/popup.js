import { checkLoginStatus, handleLogin } from './js/auth.js';
import { updateLoginStatus, updateSubmissionStatus } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loginButton = document.getElementById('githubLogin');
  const loginMessage = document.getElementById('loginMessage');
  const loginStatus = document.getElementById('loginStatus');

  try {
    console.log('Checking initial login status...');
    const isLoggedIn = await checkLoginStatus();
    console.log('Initial login status:', isLoggedIn);
    updateLoginStatus(loginButton, loginMessage, loginStatus, isLoggedIn);
  } catch (error) {
    console.error('Error during initial login check:', error);
  }

  loginButton.addEventListener('click', async () => {
    try {
      console.log('Login button clicked');
      loginButton.disabled = true;
      loginButton.textContent = 'Connecting...';
      
      const success = await handleLogin();
      console.log('Login result:', success);
      
      updateLoginStatus(loginButton, loginMessage, loginStatus, success);
    } catch (error) {
      console.error('Error during login:', error);
      updateLoginStatus(loginButton, loginMessage, loginStatus, false);
    } finally {
      loginButton.disabled = false;
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.github_token) {
      console.log('Token storage changed:', changes.github_token.newValue ? 'SET' : 'REMOVED');
      updateLoginStatus(loginButton, loginMessage, loginStatus, !!changes.github_token.newValue);
    }
  });
});