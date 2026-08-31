/* ==========================================================================
   ROUTER - CLIENT-SIDE SINGLE PAGE APPLICATION (SPA) NAVIGATION
   ========================================================================== */

class Router {
  constructor() {
    this.currentRoute = "auth";
    this.routes = [
      "auth",
      "home",
      "ai",
      "ai-game",
      "online",
      "online-game",
      "history",
      "replay",
      "profile",
    ];
  }

  init() {
    // Bind navigation clicks once at the document level so nested buttons/cards
    // do not trigger duplicate route changes from a single user click.
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-route]");
      if (!trigger) return;

      e.preventDefault();
      e.stopPropagation();
      this.navigate(trigger.dataset.route);
    });

    // Handle browser hash changes / back-forward navigation
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "");
      if (this.routes.includes(hash)) {
        this.navigate(hash, false);
      }
    });

    // Initial route check
    const initialHash = window.location.hash.replace("#", "");
    if (initialHash === "online" || initialHash === "online-game") {
      this.navigate("home", false);
    } else if (this.routes.includes(initialHash)) {
      this.navigate(initialHash, false);
    } else {
      this.navigate("home", false);
    }
  }

  navigate(viewId, updateHash = true) {
    if (!this.routes.includes(viewId)) viewId = "home";

    const isLocalHost =
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";
    if (
      isLocalHost &&
      window.location.port !== "8080" &&
      (viewId === "online" || viewId === "online-game")
    ) {
      window.location.href = "http://localhost:8080/#online";
      return;
    }

    const isAuthenticated = window.AppState.getState().isAuthenticated;
    if (!isAuthenticated && viewId !== "auth") {
      viewId = "auth";
    }
    if (isAuthenticated && viewId === "auth") {
      viewId = "home";
    }

    if (
      this.currentRoute === viewId &&
      document.getElementById(`view-${viewId}`)?.classList.contains("active")
    ) {
      if (updateHash && window.location.hash !== `#${viewId}`) {
        window.location.hash = viewId;
      }
      return;
    }

    // 1. Hide all views and show target view
    document.querySelectorAll(".app-view").forEach((view) => {
      view.classList.remove("active");
    });

    const targetElement = document.getElementById(`view-${viewId}`);
    if (targetElement) {
      targetElement.classList.add("active");
    }

    // 2. Update Header Navigation active classes
    document.querySelectorAll(".nav-link").forEach((link) => {
      const routeForActiveState = viewId === "ai-game" ? "ai" : viewId;
      if (link.dataset.route === routeForActiveState) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    this.currentRoute = viewId;
    window.AppState.setState({ currentView: viewId });

    if (updateHash && window.location.hash !== `#${viewId}`) {
      window.location.hash = viewId;
    }

    // 3. View Lifecycle Triggers
    this.onViewEnter(viewId);
  }

  onViewEnter(viewId) {
    window.scrollTo({ top: 0, behavior: "smooth" });

    switch (viewId) {
      case "auth":
        if (window.AuthController) window.AuthController.renderAuthState();
        break;
      case "home":
        if (window.ProfileView) window.ProfileView.loadProfile();
        break;
      case "ai":
        if (window.AIGame) window.AIGame.enterSetupRoute();
        break;
      case "ai-game":
        if (window.AIGame) window.AIGame.ensureActiveGameView();
        break;
      case "online":
        if (window.OnlineGame && !window.OnlineGame.isMatchmaking) {
          window.OnlineGame.startMatchmaking();
        }
        break;
      case "history":
        if (window.MatchHistory) window.MatchHistory.loadHistory();
        break;
      case "profile":
        if (window.ProfileView) window.ProfileView.loadProfile();
        break;
    }
  }
}

// Global Router Instance
window.Router = new Router();
