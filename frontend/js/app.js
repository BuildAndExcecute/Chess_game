/* ==========================================================================
   MAIN APPLICATION BOOTSTRAPPER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Chess Master Frontend Initializing...');

  try {
    // 0. Verify any saved backend login before opening protected views.
    if (window.API) await window.API.restoreBackendSession();

    // 1. Initialize Sub-controllers
    if (window.AIGame) window.AIGame.init();
    if (window.OnlineGame) window.OnlineGame.init();
    if (window.ReplayController) window.ReplayController.init();
    if (window.MatchHistory) window.MatchHistory.init();
    if (window.AuthController) window.AuthController.init();
    if (window.ProfileView) window.ProfileView.init();

    // 2. Initialize SPA Router
    if (window.Router) window.Router.init();

    // 3. Global Modal Click-Outside Dismiss handler
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    console.log('Chess Master Frontend Ready.');
  } catch (err) {
    console.error('Fatal initialization error:', err);
  }
});
