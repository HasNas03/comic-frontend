const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const catalogApi = {
  imageUrl(comicId, version = "") {
    const cacheKey = version ? `?v=${version}` : "";
    return `${API_BASE_URL}/catalog/comics/${comicId}/image${cacheKey}`;
  },

  getCatalog() {
    return request("/catalog");
  },

  getCatalogItem(comicId) {
    return request(`/catalog/${comicId}`);
  },

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
