export function updateLoginStatus(loginButton, loginMessage, loginStatus, isLoggedIn) {
  loginButton.textContent = isLoggedIn ? 'Connected' : 'Connect GitHub';
  loginMessage.textContent = isLoggedIn ? 'Connected to GitHub' : 'Not connected';
  loginStatus.classList.toggle('status-success', isLoggedIn);
  loginButton.classList.toggle('button-success', isLoggedIn);
}

export function updateSubmissionStatus(submissionStatus, submissionMessage, title) {
  submissionMessage.textContent = `Latest: ${title}`;
  submissionStatus.classList.add('status-success');
  
  submissionStatus.style.animation = 'none';
  submissionStatus.offsetHeight;
  submissionStatus.style.animation = 'pulse 0.5s ease';
}