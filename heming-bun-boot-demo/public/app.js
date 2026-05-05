const api = {
  _base: "",

  get token() {
    return localStorage.getItem("blog_token");
  },
  set token(v) {
    localStorage.setItem("blog_token", v);
  },

  get user() {
    const u = localStorage.getItem("blog_user");
    return u ? JSON.parse(u) : null;
  },
  set user(v) {
    localStorage.setItem("blog_user", JSON.stringify(v));
  },

  headers(auth) {
    const h = { "Content-Type": "application/json" };
    if (auth && this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  },

  async get(url, auth) {
    const r = await fetch(url, { headers: this.headers(auth) });
    return r.json();
  },

  async post(url, body, auth) {
    const r = await fetch(url, {
      method: "POST",
      headers: this.headers(auth),
      body: JSON.stringify(body),
    });
    return r.json();
  },

  async login(name, password) {
    const res = await this.post("/auth/login", { name, password });
    if (res.code === 0) {
      this.token = res.data.token;
      this.user = res.data.user;
    }
    return res;
  },

  async register(name, password) {
    const res = await this.post("/auth/register", { name, password });
    return res;
  },

  logout() {
    localStorage.removeItem("blog_token");
    localStorage.removeItem("blog_user");
    window.location.href = "/index.html";
  },

  isLoggedIn() {
    return !!this.token;
  },

  // ---- posts ----

  async getPosts() {
    return this.get("/posts");
  },

  async getPost(id) {
    return this.get(`/posts/${id}`);
  },

  async createPost(title, content) {
    return this.post("/posts", { title, content }, true);
  },

  async getMe() {
    return this.get("/users/me", true);
  },
};

function updateNav() {
  const nav = document.getElementById("nav-user");
  if (!nav) return;
  const user = api.user;
  if (user) {
    nav.innerHTML = `<span>👤 ${user.name}</span>
      <a href="/create.html">+ New Post</a>
      <a href="#" onclick="api.logout();return false">Logout</a>`;
  } else {
    nav.innerHTML = `<a href="/login.html">Login</a>
      <a href="/register.html">Register</a>`;
  }
}

document.addEventListener("DOMContentLoaded", updateNav);
