// ==== FIREBASE SETUP ====
// IMPORTANT: replace this with your own config from Firebase Console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {

};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ==== SMALL HELPERS ====
function getPage() {
  return document.body.dataset.page || "";
}

function querySel(id) {
  return document.getElementById(id);
}

function showMessage(id, text, type = "error") {
  const el = querySel(id);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Preloaded basic stationery (appears if DB has no products yet)
const PRELOADED_PRODUCTS = [
  {
    name: "Classic Blue Ball Pen",
    description: "0.7mm smooth gel ink for everyday writing.",
    price: 15,
    category: "Pens",
    delivery: "10–15 min"
  },
  {
    name: "A4 Spiral Notebook (200 pages)",
    description: "Thick 70 GSM paper, exam ready.",
    price: 90,
    category: "Notebooks",
    delivery: "15–20 min"
  },
  {
    name: "Mathematical Instrument Box",
    description: "Compass, divider, protractor and more.",
    price: 180,
    category: "Tools",
    delivery: "20–25 min"
  },
  {
    name: "Sticky Notes Neon Pack",
    description: "5 colors, 100 sheets each.",
    price: 75,
    category: "Notes",
    delivery: "15–18 min"
  }
];

// ==== AUTH STATE GUARD ====
auth.onAuthStateChanged(async (user) => {
  const page = getPage();
  const publicPages = ["login", "signup"];

  if (!user && !publicPages.includes(page)) {
    // Not logged in & trying to access protected page
    window.location.href = "login.html";
    return;
  }

  if (user && publicPages.includes(page)) {
    // Already logged in, redirect based on role
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const role = userDoc.exists ? userDoc.data().role : "customer";
      if (role === "seller") {
        window.location.href = "seller.html";
      } else {
        window.location.href = "customer.html";
      }
    } catch (err) {
      console.error("Role redirect error:", err);
      window.location.href = "customer.html";
    }
    return;
  }

  // If user exists & page is protected, initialize page
  initPage(user);
});

// ==== PAGE INITIALIZATION ====
function initPage(user) {
  const page = getPage();

  // Attach generic logout listener everywhere
  const logoutBtn = querySel("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await auth.signOut();
      window.location.href = "login.html";
    });
  }

  if (page === "login") setupLoginPage();
  if (page === "signup") setupSignupPage();
  if (page === "customer") setupCustomerPage(user);
  if (page === "product") setupProductPage(user);
  if (page === "cart") setupCartPage(user);
  if (page === "seller") setupSellerPage(user);
  if (page === "order-confirmation") setupOrderConfirmationPage(user);
}

// ==== SIGNUP PAGE ====
function setupSignupPage() {
  const form = querySel("signup-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("signup-message", "", "error");

    const name = form["name"].value.trim();
    const email = form["email"].value.trim();
    const password = form["password"].value.trim();
    const role = form.querySelector('input[name="role"]:checked')?.value;

    if (!name || !email || !password || !role) {
      showMessage("signup-message", "Please fill all fields.", "error");
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection("users").doc(cred.user.uid).set({
        name,
        email,
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showMessage("signup-message", "Account created. Redirecting…", "success");
    } catch (err) {
      console.error(err);
      showMessage("signup-message", err.message || "Signup failed.", "error");
    }
  });
}

// ==== LOGIN PAGE ====
function setupLoginPage() {
  const form = querySel("login-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("login-message", "", "error");

    const email = form["email"].value.trim();
    const password = form["password"].value.trim();

    if (!email || !password) {
      showMessage("login-message", "Enter email & password.", "error");
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, password);
      showMessage("login-message", "Logging you in…", "success");
    } catch (err) {
      console.error(err);
      showMessage("login-message", err.message || "Login failed.", "error");
    }
  });
}

// ==== CUSTOMER HOME ====
async function setupCustomerPage(user) {
  const grid = querySel("home-product-grid");
  const searchInput = querySel("search-input");
  const cartCountEl = querySel("cart-count");
  const cartTotalEl = querySel("cart-total");

  let renderedProducts = [];

  // Load products from Firestore where published = true
  async function loadProducts() {
    try {
    const snapshot = await db
  .collection("products")
  .where("published", "==", true)
  .get();


      if (snapshot.empty) {
        // No products yet – show preloaded
        renderedProducts = PRELOADED_PRODUCTS.map((p, index) => ({
          id: `static-${index}`,
          ...p,
          static: true
        }));
      } else {
        renderedProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      renderProducts(renderedProducts);
    } catch (err) {
      console.error("Load products:", err);
      if (grid) grid.innerHTML = "<p>Failed to load products.</p>";
    }
  }

  function renderProducts(list) {
    if (!grid) return;
    grid.innerHTML = "";

    list.forEach((p) => {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-badge">${p.category || "Stationery"}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">${p.description || ""}</div>
        <div class="product-price-row">
          <span class="price-tag">₹${p.price}</span>
          <span class="delivery-tag">${p.delivery || "15–20 min"}</span>
        </div>
        <div class="card-actions">
          <button class="btn-mini-secondary view-btn">View</button>
          <button class="btn-mini-primary add-btn">Add</button>
        </div>
      `;

      const viewBtn = card.querySelector(".view-btn");
      const addBtn = card.querySelector(".add-btn");

      viewBtn.addEventListener("click", () => {
        if (p.static) {
          // For static product, just pass name via query param
          window.location.href = `product.html?name=${encodeURIComponent(
            p.name
          )}&price=${p.price}`;
        } else {
          window.location.href = `product.html?id=${p.id}`;
        }
      });

      addBtn.addEventListener("click", () => addToCart(user, p));

      grid.appendChild(card);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = renderedProducts.filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
        );
      });
      renderProducts(filtered);
    });
  }

  async function refreshCartBar() {
    if (!user || !cartCountEl || !cartTotalEl) return;
    const snapshot = await db
      .collection("carts")
      .doc(user.uid)
      .collection("items")
      .get();

    let total = 0;
    let count = 0;
    snapshot.forEach((doc) => {
      const d = doc.data();
      total += (d.price || 0) * (d.qty || 1);
      count += d.qty || 1;
    });

    cartCountEl.textContent = count;
    cartTotalEl.textContent = total;
  }

  async function addToCart(user, product) {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (product.static) {
      // static items are not in Firestore – we add them to cart with name/price
      const cartRef = db
        .collection("carts")
        .doc(user.uid)
        .collection("items")
        .doc(product.id);

      await cartRef.set(
        {
          name: product.name,
          price: product.price,
          qty: firebase.firestore.FieldValue.increment(1),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    } else {
      const cartRef = db
        .collection("carts")
        .doc(user.uid)
        .collection("items")
        .doc(product.id);

      await cartRef.set(
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: firebase.firestore.FieldValue.increment(1),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
    await refreshCartBar();
  }

  // Expose addToCart globally so other pages can call it if needed
  window.GrubIt = window.GrubIt || {};
  window.GrubIt.addToCart = (p) => addToCart(user, p);

  await loadProducts();
  await refreshCartBar();
}

// ==== PRODUCT OVERVIEW PAGE ====
async function setupProductPage(user) {
  const grid = querySel("product-grid");
  const pageTitle = querySel("product-page-title");

  if (!grid) return;

  const id = getQueryParam("id");
  const nameParam = getQueryParam("name");
  const priceParam = getQueryParam("price");

  // CASE 1: Specific product by Firestore ID (clicked from "View")
  if (id) {
    try {
      const doc = await db.collection("products").doc(id).get();
      if (!doc.exists) {
        grid.innerHTML = "<p>Product not found.</p>";
        return;
      }

      const p = { id: doc.id, ...doc.data() };
      if (pageTitle) pageTitle.textContent = p.name || "Product";

      grid.innerHTML = "";
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-badge">${p.category || "Stationery"}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">${p.description || ""}</div>
        <div class="product-price-row">
          <span class="price-tag">₹${p.price}</span>
          <span class="delivery-tag">${p.delivery || "15–20 min"}</span>
        </div>
        <div class="card-actions">
          <button class="btn-mini-primary">Add to Cart</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", async () => {
        if (!user) {
          window.location.href = "login.html";
          return;
        }
        const cartRef = db
          .collection("carts")
          .doc(user.uid)
          .collection("items")
          .doc(p.id);

        await cartRef.set(
          {
            productId: p.id,
            name: p.name,
            price: p.price,
            qty: firebase.firestore.FieldValue.increment(1),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        window.location.href = "cart.html";
      });
      grid.appendChild(card);
      return;
    } catch (err) {
      console.error("Single product load error:", err);
      grid.innerHTML = "<p>Failed to load product.</p>";
      return;
    }
  }

  // CASE 2: Static product from preloaded list (name + price in URL)
  if (nameParam && priceParam) {
    const price = Number(priceParam) || 0;
    if (pageTitle) pageTitle.textContent = nameParam;

    grid.innerHTML = "";
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-badge">Stationery</div>
      <div class="product-name">${nameParam}</div>
      <div class="product-meta">Quick pick stationery item.</div>
      <div class="product-price-row">
        <span class="price-tag">₹${price}</span>
        <span class="delivery-tag">15–20 min</span>
      </div>
      <div class="card-actions">
        <button class="btn-mini-primary">Add to Cart</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const idKey = `static-${nameParam}-${price}`;
      const cartRef = db
        .collection("carts")
        .doc(user.uid)
        .collection("items")
        .doc(idKey);

      await cartRef.set(
        {
          productId: null,
          name: nameParam,
          price,
          qty: firebase.firestore.FieldValue.increment(1),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      window.location.href = "cart.html";
    });
    grid.appendChild(card);
    return;
  }

  // CASE 3: Generic "All products" list
  if (pageTitle) pageTitle.textContent = "All Stationery";

  let list = [];

  // Try to load from Firestore, but don't die if it fails
  try {
    const snapshot = await db
      .collection("products")
      .where("published", "==", true)
      .get(); // NO orderBy -> NO index needed

    if (!snapshot.empty) {
      list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  } catch (err) {
    console.error("All products Firestore error:", err);
    // We won't show the scary "Failed" message anymore.
    // We'll just fall back to preloaded products instead.
  }

  // If Firestore had nothing OR failed, fall back to default preloaded items
  if (list.length === 0) {
    list = PRELOADED_PRODUCTS.map((p, index) => ({
      id: `static-${index}`,
      ...p,
      static: true
    }));
  }

  grid.innerHTML = "";
  list.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-badge">${p.category || "Stationery"}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-meta">${p.description || ""}</div>
      <div class="product-price-row">
        <span class="price-tag">₹${p.price}</span>
        <span class="delivery-tag">${p.delivery || "15–20 min"}</span>
      </div>
      <div class="card-actions">
        <button class="btn-mini-primary">Add to Cart</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const idKey = p.static ? p.id : p.id;
      const cartRef = db
        .collection("carts")
        .doc(user.uid)
        .collection("items")
        .doc(idKey);

      await cartRef.set(
        {
          productId: p.static ? null : p.id,
          name: p.name,
          price: p.price,
          qty: firebase.firestore.FieldValue.increment(1),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      window.location.href = "cart.html";
    });

    grid.appendChild(card);
  });
}

// ==== SELLER DASHBOARD ====
function setupSellerPage(user) {
  const form = querySel("product-form");
  const listEl = querySel("seller-products");
  const badgeEl = querySel("seller-role-badge");
  const msgElId = "seller-message";

  if (badgeEl) badgeEl.textContent = "Seller";

  async function loadMyProducts() {
    if (!user || !listEl) return;

    try {
      const snapshot = await db
        .collection("products")
        .where("sellerId", "==", user.uid)
        .get(); // simple query, no index needed

      listEl.innerHTML = "";

      if (snapshot.empty) {
        listEl.innerHTML = "<p>No products yet. Add something fresh ✏️</p>";
        return;
      }

      snapshot.forEach((doc) => {
        const p = { id: doc.id, ...doc.data() };
        const row = document.createElement("div");
        row.className = "seller-item";
        row.innerHTML = `
          <div class="seller-item-main">
            <div><strong>${p.name}</strong></div>
            <div style="font-size:0.75rem;color:#bbbbbb;">₹${p.price} · ${p.category || "Stationery"}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end;">
            <span class="seller-status-badge ${
              p.published ? "published" : "draft"
            }">${p.published ? "Published" : "Draft"}</span>
            <button class="btn-mini-secondary toggle-btn">${
              p.published ? "Unpublish" : "Publish"
            }</button>
          </div>
        `;

        const toggleBtn = row.querySelector(".toggle-btn");
        toggleBtn.addEventListener("click", async () => {
          try {
            await db.collection("products").doc(p.id).update({
              published: !p.published
            });
            loadMyProducts();
          } catch (err) {
            console.error("Toggle publish error:", err);
            showMessage(msgElId, err.message || "Failed to update product.", "error");
          }
        });

        listEl.appendChild(row);
      });
    } catch (err) {
      console.error("Load my products error:", err);
      listEl.innerHTML = "<p>Could not load products (check console).</p>";
      showMessage(msgElId, err.message || "Failed to load products.", "error");
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showMessage(msgElId, "", "error");

      const name = form["name"].value.trim();
      const price = Number(form["price"].value);
      const category = form["category"].value.trim();
      const description = form["description"].value.trim();
      const publishNow = !!form["publishNow"].checked;

      if (!name || !price) {
        showMessage(msgElId, "Name and price are required.", "error");
        return;
      }

      try {
        await db.collection("products").add({
          name,
          price,
          category: category || "Stationery",
          description,
          delivery: "15–20 min",
          sellerId: user.uid,
          published: publishNow,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        form.reset();
        showMessage(msgElId, "Product saved successfully.", "success");
        await loadMyProducts();
      } catch (err) {
        console.error("Add product error:", err);
        showMessage(msgElId, err.message || "Failed to save product.", "error");
      }
    });
  }

  loadMyProducts();
}



