/* ==========================================================================
   PROFILE & SETTINGS CONTROLLER
   ========================================================================== */

class ProfileController {
  constructor() {
    this.user = null;
  }

  init() {
    this.bindEvents();
    if (window.AppState.getState().isAuthenticated) {
      this.loadProfile();
    }
  }

  bindEvents() {
    // Save Profile button
    const btnSaveProfile = document.getElementById("btn-save-profile");
    if (btnSaveProfile) {
      btnSaveProfile.onclick = (e) => {
        e.preventDefault();
        this.saveProfile();
      };
    }

    // Settings Toggles - Real-time sync to localStorage
    const soundToggle = document.getElementById("setting-sound");
    const coordsToggle = document.getElementById("setting-coords");
    const themeToggle = document.getElementById("setting-theme");
    const confirmToggle = document.getElementById("setting-confirm-move");

    if (soundToggle) {
      soundToggle.addEventListener("change", (e) => {
        window.AppState.updateSettings({ soundEnabled: e.target.checked });
        window.GameCtrl.showToast(
          `Sound effects ${e.target.checked ? "enabled" : "muted"}`,
          "info",
        );
      });
    }

    if (coordsToggle) {
      coordsToggle.addEventListener("change", (e) => {
        window.AppState.updateSettings({ showCoordinates: e.target.checked });
        window.GameCtrl.showToast(
          `Board coordinates ${e.target.checked ? "shown" : "hidden"}`,
          "info",
        );
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener("change", (e) => {
        const theme = e.target.checked ? "light" : "dark";
        window.AppState.updateSettings({ theme });
        window.GameCtrl.showToast(`Theme switched to ${theme} mode`, "info");
      });
    }

    if (confirmToggle) {
      confirmToggle.addEventListener("change", (e) => {
        window.AppState.updateSettings({ moveConfirmation: e.target.checked });
        window.GameCtrl.showToast(
          `Move confirmation ${e.target.checked ? "enabled" : "disabled"}`,
          "info",
        );
      });
    }
  }

  async loadProfile() {
    if (!window.AppState.getState().isAuthenticated) {
      this.user = null;
      return;
    }

    try {
      this.user = await window.API.getProfile();
      this.renderProfile();
      this.renderSettings();
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }

  renderProfile() {
    if (!this.user) return;

    // Header Quick Profile
    const headerName = document.getElementById("header-username");
    const headerRating = document.getElementById("header-rating");
    const headerAvatar = document.getElementById("header-avatar");

    if (headerName) headerName.textContent = this.user.username;
    if (headerRating) headerRating.textContent = `Rating ${this.user.rating}`;
    if (headerAvatar)
      headerAvatar.textContent =
        this.user.initials || this.user.username.substring(0, 2).toUpperCase();

    // Home Screen User Summary
    const homeName = document.getElementById("home-username");
    const homeRating = document.getElementById("home-rating");
    const homeGames = document.getElementById("home-games-played");
    const homeWins = document.getElementById("home-wins");
    const homeLosses = document.getElementById("home-losses");
    const homeDraws = document.getElementById("home-draws");

    if (homeName) homeName.textContent = this.user.username;
    if (homeRating) homeRating.textContent = this.user.rating;
    if (homeGames) homeGames.textContent = this.user.stats.gamesPlayed;
    if (homeWins) homeWins.textContent = this.user.stats.wins;
    if (homeLosses) homeLosses.textContent = this.user.stats.losses;
    if (homeDraws) homeDraws.textContent = this.user.stats.draws;

    // Profile Screen Form
    const inputUsername = document.getElementById("profile-input-username");
    const inputEmail = document.getElementById("profile-input-email");
    const profileRating = document.getElementById("profile-rating-badge");
    const profileWinrate = document.getElementById("profile-winrate");
    const profileAvatar = document.getElementById("profile-avatar-large");

    if (inputUsername) inputUsername.value = this.user.username;
    if (inputEmail) inputEmail.value = this.user.email;
    if (profileRating)
      profileRating.textContent = `Elo Rating: ${this.user.rating}`;
    if (profileWinrate)
      profileWinrate.textContent = `Win Rate: ${this.user.stats.winRate}`;
    if (profileAvatar)
      profileAvatar.textContent =
        this.user.initials || this.user.username.substring(0, 2).toUpperCase();
  }

  renderSettings() {
    const settings = window.AppState.getState().settings;

    const soundToggle = document.getElementById("setting-sound");
    const coordsToggle = document.getElementById("setting-coords");
    const themeToggle = document.getElementById("setting-theme");
    const confirmToggle = document.getElementById("setting-confirm-move");

    if (soundToggle) soundToggle.checked = !!settings.soundEnabled;
    if (coordsToggle) coordsToggle.checked = !!settings.showCoordinates;
    if (themeToggle) themeToggle.checked = settings.theme === "light";
    if (confirmToggle) confirmToggle.checked = !!settings.moveConfirmation;
  }

  async saveProfile() {
    if (!this.user) return;

    const inputUsername = document.getElementById("profile-input-username");
    const inputEmail = document.getElementById("profile-input-email");

    const updatedData = {
      username: inputUsername ? inputUsername.value.trim() : this.user.username,
      email: inputEmail ? inputEmail.value.trim() : this.user.email,
      initials: (inputUsername
        ? inputUsername.value.trim()
        : this.user.username
      )
        .substring(0, 2)
        .toUpperCase(),
    };

    try {
      const res = await window.API.updateProfile(updatedData);
      this.user = res.user;
      this.renderProfile();
      window.GameCtrl.showToast("Profile updated successfully!", "success");
    } catch (err) {
      console.error("Failed to update profile:", err);
      window.GameCtrl.showToast("Failed to update profile.", "error");
    }
  }
}

// Global Profile Controller Instance
window.ProfileView = new ProfileController();
