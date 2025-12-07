// ==== FIREBASE SETUP ====
// IMPORTANT: replace this with your own config from Firebase Console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCR01N7CSB7OfB8VxHzkV725Zeo7ct-ibA",
  authDomain: "grubit-45d09.firebaseapp.com",
  projectId: "grubit-45d09",
  storageBucket: "grubit-45d09.firebasestorage.app",
  messagingSenderId: "787109161650",
  appId: "1:787109161650:web:bb9a0f8f321f8a75bb77ab",
  measurementId: "G-3P7M922KET"
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
        .orderBy("createdAt", "desc")
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

  const id = getQueryParam("id");
  const nameParam = getQueryParam("name");
  const priceParam = getQueryParam("price");

  if (id && grid) {
    // Single product from Firestore
    try {
      const doc = await db.collection("products").doc(id).get();
      if (!doc.exists) {
        grid.innerHTML = "<p>Product not found.</p>";
        return;
      }
      const p = { id: doc.id, ...doc.data() };
      pageTitle.textContent = p.name;

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
    } catch (err) {
      console.error(err);
      grid.innerHTML = "<p>Failed to load product.</p>";
    }
  } else {
    // Generic product listing using same loader as customer home
    pageTitle.textContent = "All Stationery";
    try {
      const snapshot = await db
        .collection("products")
        .where("published", "==", true)
        .orderBy("createdAt", "desc")
        .get();

      let list = [];
      if (snapshot.empty) {
        list = PRELOADED_PRODUCTS.map((p, index) => ({
          id: `static-${index}`,
          ...p,
          static: true
        }));
      } else {
        list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
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
    } catch (err) {
      console.error(err);
      grid.innerHTML = "<p>Failed to load products.</p>";
    }
  }
}

// ==== CART PAGE ====
async function setupCartPage(user) {
  const listEl = querySel("cart-list");
  const totalEl = querySel("cart-total");
  const placeOrderBtn = querySel("place-order-btn");
  const statusEl = querySel("cart-message");

  async function loadCart() {
    if (!user) return;
    const snapshot = await db
      .collection("carts")
      .doc(user.uid)
      .collection("items")
      .get();

    listEl.innerHTML = "";
    let total = 0;

    if (snapshot.empty) {
      listEl.innerHTML = "<p>Your cart is empty.</p>";
      totalEl.textContent = "0";
      return;
    }

    snapshot.forEach((doc) => {
      const item = { id: doc.id, ...doc.data() };
      const lineTotal = (item.price || 0) * (item.qty || 1);
      total += lineTotal;

      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-main">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">₹${item.price} x ${item.qty}</div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-controls">
            <button data-action="dec">-</button>
            <span>${item.qty}</span>
            <button data-action="inc">+</button>
          </div>
          <button class="btn-mini-secondary remove-btn">Remove</button>
        </div>
      `;

      const decBtn = row.querySelector('button[data-action="dec"]');
      const incBtn = row.querySelector('button[data-action="inc"]');
      const removeBtn = row.querySelector(".remove-btn");

      incBtn.addEventListener("click", async () => {
        await updateQty(item.id, (item.qty || 1) + 1);
      });
      decBtn.addEventListener("click", async () => {
        const newQty = (item.qty || 1) - 1;
        if (newQty <= 0) {
          await deleteItem(item.id);
        } else {
          await updateQty(item.id, newQty);
        }
      });
      removeBtn.addEventListener("click", async () => {
        await deleteItem(item.id);
      });

      listEl.appendChild(row);
    });

    totalEl.textContent = total.toString();
  }

  async function updateQty(id, qty) {
    await db
      .collection("carts")
      .doc(user.uid)
      .collection("items")
      .doc(id)
      .update({ qty });
    await loadCart();
  }

  async function deleteItem(id) {
    await db
      .collection("carts")
      .doc(user.uid)
      .collection("items")
      .doc(id)
      .delete();
    await loadCart();
  }

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", async () => {
      statusEl.textContent = "";
      const snapshot = await db
        .collection("carts")
        .doc(user.uid)
        .collection("items")
        .get();

      if (snapshot.empty) {
        statusEl.textContent = "Cart is empty.";
        return;
      }

      let items = [];
      let total = 0;
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({ id: doc.id, ...d });
        total += (d.price || 0) * (d.qty || 1);
      });

      const orderRef = await db.collection("orders").add({
        userId: user.uid,
        items,
        total,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Clear cart
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      window.location.href = `order-confirmation.html?orderId=${orderRef.id}`;
    });
  }

  await loadCart();
}

// ==== ORDER CONFIRMATION PAGE ====
function setupOrderConfirmationPage(user) {
  const orderId = getQueryParam("orderId");
  const orderIdEl = querySel("order-id");
  if (orderId && orderIdEl) {
    orderIdEl.textContent = orderId;
  }
}

// ==== SELLER DASHBOARD ====
// ==== SELLER DASHBOARD ====
function setupSellerPage(user) {
  const form = querySel("product-form");
  const listEl = querySel("seller-products");
  const badgeEl = querySel("seller-role-badge");

  if (badgeEl) badgeEl.textContent = "Seller";

  async function loadMyProducts() {
    if (!user) return;
    const snapshot = await db
      .collection("products")
      .where("sellerId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();

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
        await db.collection("products").doc(p.id).update({
          published: !p.published
        });
        loadMyProducts();
      });

      listEl.appendChild(row);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form["name"].value.trim();
      const price = Number(form["price"].value);
      const category = form["category"].value.trim();
      const description = form["description"].value.trim();
      const publishNow = !!form["publishNow"].checked;  // 👈 NEW

      if (!name || !price) return;

      await db.collection("products").add({
        name,
        price,
        category: category || "Stationery",
        description,
        delivery: "15–20 min",
        sellerId: user.uid,
        published: publishNow, // 👈 publish immediately if checked
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      form.reset();
      loadMyProducts();
    });
  }

  loadMyProducts();
}


