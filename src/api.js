// This file is the frontend API boundary.
//
// App.jsx imports catalogApi and calls friendly JavaScript methods such as
// catalogApi.getCatalog() or catalogApi.addRating(...). Those methods are
// thin wrappers around fetch(), which is the browser function that sends an
// HTTP request to your Spring Boot catalog service.

// In local development Vite can proxy /api to the backend. If you later set
// VITE_API_BASE_URL, this same frontend can point somewhere else without
// changing component code.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Sends normal JSON requests.
//
// Flow:
// 1. A component calls one of the catalogApi methods below.
// 2. That method calls request(path, options).
// 3. fetch() sends the HTTP request to the backend.
// 4. The response body is read and parsed.
// 5. Good responses return data to the component; bad responses throw an Error
//    that the component can catch and show in the UI.
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      // Spring controllers using @RequestBody expect JSON for these calls.
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  // 204 means the backend succeeded but intentionally returned no JSON body.
  // DELETE endpoints commonly use this.
  if (response.status === 204) {
    return null;
  }

  // Read text first so this helper works with both JSON errors and plain-text
  // errors. safeJson() turns JSON strings into objects when possible.
  const text = await response.text();
  const data = text ? safeJson(text) : null;

  // fetch() only rejects for network-level failures. A 400/404/500 still comes
  // back as a response, so we manually throw here when response.ok is false.
  if (!response.ok) {
    const message = data?.message || data?.error || text || `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = data || text;
    throw error;
  }

  return data;
}

// Sends image upload requests.
//
// Image requests are different from JSON requests because file uploads need
// multipart/form-data. We do not set Content-Type manually here; the browser
// adds the correct multipart boundary when the body is FormData.
async function upload(path, file, method) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    body: formData
  });

  const text = response.status === 204 ? "" : await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || text || `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = data || text;
    throw error;
  }

  return data;
}

// Some backend responses are JSON and some may be plain text. This helper lets
// the API layer accept both without crashing while parsing an error response.
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// The rest of the frontend imports this object instead of importing fetch.
// Keeping all endpoint paths here makes App.jsx easier to read and makes future
// backend URL changes less painful.
export const catalogApi = {
  // The image endpoint returns bytes, not JSON. Components use this string in
  // an <img src="..."> tag, so the browser downloads the image automatically.
  imageUrl(comicId, version = "") {
    const cacheKey = version ? `?v=${version}` : "";
    return `${API_BASE_URL}/catalog/comics/${comicId}/image${cacheKey}`;
  },

  // ----- Library/catalog reads -----
  getCatalog() {
    return request("/catalog");
  },

  getCatalogItem(comicId) {
    return request(`/catalog/${comicId}`);
  },

  // ----- Wanted comics -----
  getWantedCatalog() {
    return request("/catalog/wanted");
  },

  addWantedComic(comic) {
    return request("/catalog/wanted", {
      method: "POST",
      body: JSON.stringify(comic)
    });
  },

  moveWantedComicToLibrary(comicId) {
    return request(`/catalog/wanted/${comicId}/move-to-library`, {
      method: "PUT"
    });
  },

  // ----- Normal comic CRUD -----
  addComic(comic) {
    return request("/catalog/comics", {
      method: "POST",
      body: JSON.stringify(comic)
    });
  },

  updateComic(comicId, comic) {
    return request(`/catalog/comics/${comicId}`, {
      method: "PUT",
      body: JSON.stringify(comic)
    });
  },

  deleteComic(comicId) {
    return request(`/catalog/comics/${comicId}`, {
      method: "DELETE"
    });
  },

  // ----- Cover image CRUD -----
  addComicImage(comicId, file) {
    return upload(`/catalog/comics/${comicId}/image`, file, "POST");
  },

  updateComicImage(comicId, file) {
    return upload(`/catalog/comics/${comicId}/image`, file, "PUT");
  },

  deleteComicImage(comicId) {
    return request(`/catalog/comics/${comicId}/image`, {
      method: "DELETE"
    });
  },

  // ----- Collections -----
  getCollections() {
    return request("/catalog/collections");
  },

  getCollection(collectionId) {
    return request(`/catalog/collections/${collectionId}`);
  },

  addCollection(collection) {
    return request("/catalog/collections", {
      method: "POST",
      body: JSON.stringify(collection)
    });
  },

  updateCollection(collectionId, collection) {
    return request(`/catalog/collections/${collectionId}`, {
      method: "PUT",
      body: JSON.stringify(collection)
    });
  },

  deleteCollection(collectionId) {
    return request(`/catalog/collections/${collectionId}`, {
      method: "DELETE"
    });
  },

  addComicToCollection(collectionId, comicId) {
    return request(`/catalog/collections/${collectionId}/comics/${comicId}`, {
      method: "POST"
    });
  },

  removeComicFromCollection(collectionId, comicId) {
    return request(`/catalog/collections/${collectionId}/comics/${comicId}`, {
      method: "DELETE"
    });
  },

  // ----- Ratings -----
  addRating(rating) {
    return request("/catalog/ratings", {
      method: "POST",
      body: JSON.stringify(rating)
    });
  },

  updateRating(ratingId, rating) {
    return request(`/catalog/ratings/${ratingId}`, {
      method: "PUT",
      body: JSON.stringify(rating)
    });
  },

  deleteRating(ratingId) {
    return request(`/catalog/ratings/${ratingId}`, {
      method: "DELETE"
    });
  }
};
