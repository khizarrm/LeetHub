export async function checkLoginStatus() {
  const storedData = await chrome.storage.sync.get('github_token');
  return !!storedData.github_token;
}

export async function handleLogin() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
    if (response.token) {
      await chrome.storage.sync.set({ 'github_token': response.token });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}