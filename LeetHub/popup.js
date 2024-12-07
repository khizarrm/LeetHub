import { checkLoginStatus, handleLogin } from './js/auth.js';
import { updateLoginStatus, updateSubmissionStatus } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loginButton = document.getElementById('githubLogin');
  const loginMessage = document.getElementById('loginMessage');
  const submissionMessage = document.getElementById('submissionMessage');
  const loginStatus = document.getElementById('loginStatus');
  const submissionStatus = document.getElementById('submissionStatus');

  // Check initial login status
  const isLoggedIn = await checkLoginStatus();
  if (isLoggedIn) {
    updateLoginStatus(loginButton, loginMessage, loginStatus, true);
  }

  // Listen for submission updates
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'completed') {
      updateSubmissionStatus(submissionStatus, submissionMessage, request.title);
    }
  });

  // Handle login button click
  loginButton.addEventListener('click', async () => {
    const success = await handleLogin();
    updateLoginStatus(loginButton, loginMessage, loginStatus, success);
  });
});