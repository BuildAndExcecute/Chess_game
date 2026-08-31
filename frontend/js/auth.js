/* ==========================================================================
   AUTH CONTROLLER - MOCK LOGIN, SIGNUP & LOGOUT FLOW
   ========================================================================== */

class AuthController {
  constructor() {
    this.mode = 'login';
  }

  init() {
    this.bindEvents();
    this.renderAuthState();

    window.AppState.subscribe('authChanged', () => {
      this.renderAuthState();
    });
  }

  bindEvents() {
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.addEventListener('click', () => this.switchMode(button.dataset.authMode));
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.login();
      });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.signup();
      });
    }

    const logoutButton = document.getElementById('btn-logout');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => this.logout());
    }
  }

  switchMode(mode) {
    this.mode = mode === 'signup' ? 'signup' : 'login';

    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.authMode === this.mode);
    });

    const loginPanel = document.getElementById('auth-login-panel');
    const signupPanel = document.getElementById('auth-signup-panel');
    if (loginPanel) loginPanel.classList.toggle('active', this.mode === 'login');
    if (signupPanel) signupPanel.classList.toggle('active', this.mode === 'signup');

    this.showMessage('');
  }

  async login() {
    const email = document.getElementById('login-email')?.value || '';
    const password = document.getElementById('login-password')?.value || '';

    try {
      await window.API.login({ email, password });
      window.GameCtrl.showToast('Logged in successfully.', 'success');
      window.Router.navigate('home');
    } catch (error) {
      this.showMessage(error.message || 'Login failed.', 'error');
    }
  }

  async signup() {
    const username = document.getElementById('signup-username')?.value || '';
    const email = document.getElementById('signup-email')?.value || '';
    const password = document.getElementById('signup-password')?.value || '';

    if (password.length < 6) {
      this.showMessage('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      await window.API.signup({ username, email, password });
      window.GameCtrl.showToast('Profile created successfully.', 'success');
      window.Router.navigate('home');
    } catch (error) {
      this.showMessage(error.message || 'Signup failed.', 'error');
    }
  }

  async logout() {
    try {
      await window.API.logout();
      window.GameCtrl.showToast('Logged out successfully.', 'info');
      window.Router.navigate('auth');
    } catch (error) {
      window.GameCtrl.showToast(error.message || 'Logout failed.', 'error');
    }
  }

  renderAuthState() {
    const isAuthenticated = window.AppState.getState().isAuthenticated;
    document.body.classList.toggle('is-authenticated', isAuthenticated);
    document.body.classList.toggle('is-guest', !isAuthenticated);
  }

  showMessage(message, type = 'info') {
    const messageBox = document.getElementById('auth-message');
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `auth-message ${message ? 'active' : ''} auth-message-${type}`;
  }
}

window.AuthController = new AuthController();
