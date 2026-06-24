import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Github,
  Home,
  Library,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X
} from "lucide-react";
import { catalogApi } from "./api";

const emptyComic = {
  comicTitle: "",
  comicIssue: "",
  comicStartYear: "",
  comicDesc: ""
};

const emptyRating = {
  ratingScore: 0,
  ratingReview: ""
};

export default function App() {
  const [view, setView] = useState("library");
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ratingModalItem, setRatingModalItem] = useState(null);
  const [prefilledComicId, setPrefilledComicId] = useState("");

  async function loadCatalog() {
    setLoading(true);
    setError("");

    try {
      const data = await catalogApi.getCatalog();
      setCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  function goToLibrary(message = "") {
    setView("library");
    setPrefilledComicId("");
    setNotice(message);
    loadCatalog();
  }

  function goToAddRating(comicId = "") {
    setPrefilledComicId(comicId);
    setView("addRating");
    setNotice("");
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={view}
        onNavigate={(nextView) => {
          setView(nextView);
          setNotice("");
        }}
      />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1>Your Library</h1>
          </div>
          <button className="icon-button" onClick={loadCatalog} title="Refresh catalog">
            <RefreshCw size={20} />
          </button>
        </header>

        {notice && (
          <div className="notice">
            <Check size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {view === "library" && (
          <LibraryView
            catalog={catalog}
            loading={loading}
            onAddComic={() => setView("addComic")}
            onAddRating={goToAddRating}
            onManageRating={setRatingModalItem}
            onDeleteComic={async (item) => {
              await catalogApi.deleteComic(item.comicId);
              goToLibrary(`${item.comicTitle} was deleted.`);
            }}
          />
        )}

        {view === "addComic" && (
          <AddComicView
            onCancel={() => goToLibrary()}
            onCreated={(comic) => {
              setPrefilledComicId(comic.comicId);
              setNotice(`${comic.comicTitle} was added.`);
              loadCatalog();
            }}
            onRateNewComic={(comicId) => goToAddRating(comicId)}
          />
        )}

        {view === "addRating" && (
          <AddRatingView
            catalog={catalog}
            prefilledComicId={prefilledComicId}
            onCancel={() => goToLibrary()}
            onCreated={(rating) => {
              goToLibrary(`Rating saved at ${rating.ratingScore}/10.`);
            }}
            onManageExisting={setRatingModalItem}
          />
        )}
      </main>

      {ratingModalItem && (
        <RatingModal
          item={ratingModalItem}
          onClose={() => setRatingModalItem(null)}
          onSaved={(message) => {
            setRatingModalItem(null);
            goToLibrary(message);
          }}
        />
      )}
    </div>
  );
}

function Sidebar({ activeView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BookOpen size={28} />
        <div>
          <strong>Comic Catalog</strong>
          <span>Track all your comics!</span>
        </div>
      </div>

      <nav className="nav-list">
        <button className={activeView === "library" ? "active" : ""} onClick={() => onNavigate("library")}>
          <Home size={18} />
          Library
        </button>
        <button className={activeView === "addComic" ? "active" : ""} onClick={() => onNavigate("addComic")}>
          <Plus size={18} />
          Add Comic
        </button>
        <button className={activeView === "addRating" ? "active" : ""} onClick={() => onNavigate("addRating")}>
          <Star size={18} />
          Add Rating
        </button>
      </nav>

      <a className="github-link" href="https://github.com/HasNas03/" target="_blank" rel="noreferrer">
        <Github size={18} />
        GitHub
      </a>
    </aside>
  );
}

function LibraryView({ catalog, loading, onAddComic, onAddRating, onManageRating, onDeleteComic }) {
  const ratedCount = catalog.filter((item) => item.ratingScore != null).length;
  const average = ratedCount
    ? (catalog.reduce((sum, item) => sum + (item.ratingScore || 0), 0) / ratedCount).toFixed(1)
    : "0.0";

  if (loading) {
    return <EmptyState title="Loading library" text="Fetching your catalog." />;
  }

  return (
    <section className="content-stack">
      <div className="summary-grid">
        <SummaryTile label="Comics" value={catalog.length} variant="comics" icon={<BookOpen size={26} />} />
        <SummaryTile label="Rated" value={ratedCount} variant="rated" icon={<Star size={26} />} />
        <SummaryTile label="Average Rating" value={average} variant="average" icon={<Check size={26} />} />
      </div>

      {catalog.length === 0 ? (
        <EmptyState
          title="No comics yet"
          text="Add your first comic to start building your collection."
          actionLabel="Add Comic"
          onAction={onAddComic}
        />
      ) : (
        <div className="catalog-list">
          {catalog.map((item) => (
            <CatalogCard
              key={item.comicId}
              item={item}
              onDeleteComic={onDeleteComic}
              onManageRating={onManageRating}
              onAddRating={onAddRating}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryTile({ label, value, variant, icon }) {
  return (
    <div className={`summary-tile ${variant || ""}`}>
      <div className="summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CatalogCard({ item, onDeleteComic, onManageRating, onAddRating }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hasRating = item.ratingScore != null;
  useCloseOnOutsideClick(ref, open, setOpen);

  return (
    <article className="catalog-card" ref={ref}>
      <div className="card-main">
        <div>
          <h2>{item.comicTitle}</h2>
          <p className="muted">Issue #<span className="kv">{item.comicIssue || "—"}</span> · <span className="kv">{item.comicStartYear || "—"}</span></p>
          <p className="comic-id">Comic ID: {item.comicId}</p>
        </div>
        <RatingStars value={item.ratingScore || 0} readOnly />
      </div>

      {item.comicDesc && <p className="description">{item.comicDesc}</p>}
      {item.ratingReview && <p className="review">"{item.ratingReview}"</p>}

      <div className="card-menu">
        <button className="icon-button" onClick={() => setOpen((current) => !current)} title="Comic actions">
          <MoreVertical size={20} />
        </button>

        {open && (
          <div className="menu-popover">
            <button onClick={() => onManageRating(item)}>
              <Pencil size={16} />
              {hasRating ? "Manage Rating" : "Add Rating"}
            </button>
            {!hasRating && (
              <button onClick={() => onAddRating(item.comicId)}>
                <Star size={16} />
                Rate From Page
              </button>
            )}
            <button
              className="danger"
              onClick={() => {
                const confirmed = window.confirm(`Delete ${item.comicTitle}? This also deletes its rating.`);
                if (confirmed) {
                  onDeleteComic(item);
                }
              }}
            >
              <Trash2 size={16} />
              Delete Comic
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// close menu when clicking outside any open CatalogCard
function useCloseOnOutsideClick(ref, open, setOpen) {
  useEffect(() => {
    function onDoc(e) {
      if (!open) return;
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, open, setOpen]);
}

function AddComicView({ onCancel, onCreated, onRateNewComic }) {
  const [form, setForm] = useState(emptyComic);
  const [createdComic, setCreatedComic] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const created = await catalogApi.addComic(form);
      setCreatedComic(created);
      setForm(emptyComic);
      onCreated(created);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  if (createdComic) {
    return (
      <SuccessPanel
        title={`${createdComic.comicTitle} was added`}
        text="The comic is in your library."
        primaryLabel="Rate This Comic"
        onPrimary={() => onRateNewComic(createdComic.comicId)}
        secondaryLabel="Back Home"
        onSecondary={onCancel}
        tertiaryLabel="Add another comic"
        onTertiary={() => {
          // reset created state so the form is shown again for a new comic
          setCreatedComic(null);
        }}
      />
    );
  }

  return (
    <section className="form-panel add-comic">
      <div className="section-heading">
        <p className="eyebrow">New comic</p>
        <h2>Add a Comic</h2>
      </div>

      {error && <InlineError message={error} />}

      <form onSubmit={handleSubmit} className="form-grid">
        <TextField
          label="Title"
          value={form.comicTitle}
          onChange={(comicTitle) => setForm({ ...form, comicTitle })}
          required
        />
        <TextField
          label="Issue Number"
          value={form.comicIssue}
          onChange={(comicIssue) => setForm({ ...form, comicIssue })}
          required
        />
        <TextField
          label="Start Year"
          value={form.comicStartYear}
          onChange={(comicStartYear) => setForm({ ...form, comicStartYear })}
          inputMode="numeric"
        />
        <TextArea
          label="Description"
          value={form.comicDesc}
          onChange={(comicDesc) => setForm({ ...form, comicDesc })}
        />

        <div className="button-row">
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save Comic"}
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function AddRatingView({ catalog, prefilledComicId, onCancel, onCreated, onManageExisting }) {
  const [selectedComicId, setSelectedComicId] = useState(prefilledComicId || "");
  const [rating, setRating] = useState(emptyRating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedComic = useMemo(
    () => catalog.find((item) => item.comicId === selectedComicId),
    [catalog, selectedComicId]
  );
  const alreadyRated = selectedComic?.ratingId != null;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedComicId) {
      setError("Choose a comic first.");
      return;
    }

    if (alreadyRated) {
      onManageExisting(selectedComic);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const created = await catalogApi.addRating({
        comicId: selectedComicId,
        ratingScore: rating.ratingScore,
        ratingReview: rating.ratingReview
      });
      setRating(emptyRating);
      onCreated(created);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-panel wide">
      <div className="section-heading">
        <p className="eyebrow">New rating</p>
        <h2>Add a Rating</h2>
      </div>

      {error && <InlineError message={error} />}

      <form onSubmit={handleSubmit} className="rating-layout">
        <label className="select-field">
          <span>Comic</span>
          <select value={selectedComicId} onChange={(event) => setSelectedComicId(event.target.value)}>
            <option value="">Choose a comic</option>
            {catalog.map((item) => (
              <option key={item.comicId} value={item.comicId}>
                {item.comicTitle} | #{item.comicIssue}
              </option>
            ))}
          </select>
          <ChevronDown size={18} />
        </label>

        <div className="rating-form-area">
          {selectedComic ? (
            <>
              <div className="selected-comic">
                <h3>{selectedComic.comicTitle}</h3>
                <p>{selectedComic.comicIssue} · ID {selectedComic.comicId}</p>
              </div>

              <InteractiveStars
                value={alreadyRated ? selectedComic.ratingScore : rating.ratingScore}
                onChange={(ratingScore) => setRating({ ...rating, ratingScore })}
                disabled={alreadyRated}
              />

              <TextArea
                label="Review"
                value={alreadyRated ? selectedComic.ratingReview || "" : rating.ratingReview}
                onChange={(ratingReview) => setRating({ ...rating, ratingReview })}
                disabled={alreadyRated}
              />

              {alreadyRated && <InlineError message="This comic already has a rating. Use Manage Rating to edit it." />}
            </>
          ) : (
            <EmptyState title="Choose a comic" text="Select a comic from your library." />
          )}
        </div>

        <div className="button-row full-width">
          <button className="primary-button" disabled={saving || !selectedComicId || (!alreadyRated && rating.ratingScore === 0)}>
            {alreadyRated ? "Manage Existing Rating" : saving ? "Saving..." : "Save Rating"}
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function RatingModal({ item, onClose, onSaved }) {
  const hasRating = item.ratingId != null;
  const [rating, setRating] = useState({
    ratingScore: item.ratingScore || 0,
    ratingReview: item.ratingReview || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveRating() {
    if (rating.ratingScore === 0) {
      setError("Choose a rating from 1 to 10.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (hasRating) {
        await catalogApi.updateRating(item.ratingId, rating);
        onSaved("Rating updated.");
      } else {
        await catalogApi.addRating({
          comicId: item.comicId,
          ...rating
        });
        onSaved("Rating added.");
      }
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRating() {
    const confirmed = window.confirm(`Delete rating for ${item.comicTitle}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await catalogApi.deleteRating(item.ratingId);
      onSaved("Rating deleted.");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Rating</p>
            <h2>{item.comicTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {error && <InlineError message={error} />}

        <InteractiveStars
          value={rating.ratingScore}
          onChange={(ratingScore) => setRating({ ...rating, ratingScore })}
        />

        <TextArea
          label="Review"
          value={rating.ratingReview}
          onChange={(ratingReview) => setRating({ ...rating, ratingReview })}
        />

        <div className="button-row">
          <button className="primary-button" onClick={saveRating} disabled={saving}>
            {saving ? "Saving..." : hasRating ? "Update Rating" : "Add Rating"}
          </button>
          {hasRating && (
            <button className="danger-button" onClick={deleteRating} disabled={saving}>
              Delete Rating
            </button>
          )}
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RatingStars({ value, readOnly = false }) {
  return (
    <div className={`stars ${readOnly ? "readonly" : ""}`} aria-label={`${value || 0} out of 10`}>
      {Array.from({ length: 10 }, (_, index) => {
        const filled = index < value;
        return (
          <Star
            key={index}
            size={22}
            fill={filled ? "currentColor" : "none"}
            className={filled ? "filled" : ""}
          />
        );
      })}
    </div>
  );
}

function InteractiveStars({ value, onChange, disabled = false }) {
  const [hovered, setHovered] = useState(0);
  const shownValue = hovered || value || 0;

  return (
    <div className="interactive-stars">
      <RatingStars value={shownValue} />
      <div className="star-buttons">
        {Array.from({ length: 10 }, (_, index) => {
          const score = index + 1;
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHovered(score)}
              onMouseLeave={() => setHovered(0)}
              onFocus={() => setHovered(score)}
              onBlur={() => setHovered(0)}
              onClick={() => onChange(score)}
              aria-label={`${score} stars`}
            />
          );
        })}
      </div>
      <strong>{shownValue}/10</strong>
    </div>
  );
}

function TextField({ label, value, onChange, required = false, inputMode = "text" }) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, disabled = false }) {
  return (
    <label className="text-field textarea-field">
      <span>{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
      />
    </label>
  );
}

function InlineError({ message }) {
  return (
    <div className="inline-error">
      <AlertTriangle size={16} />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <Library size={36} />
      <h2>{title}</h2>
      <p>{text}</p>
      {actionLabel && <button className="primary-button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function SuccessPanel({ title, text, primaryLabel, onPrimary, secondaryLabel, onSecondary, tertiaryLabel, onTertiary }) {
  return (
    <section className="success-panel">
      <div className="success-icon">
        <Check size={34} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="button-row centered">
        <button className="primary-button" onClick={onPrimary}>{primaryLabel}</button>
        <button className="secondary-button" onClick={onSecondary}>{secondaryLabel}</button>
        {tertiaryLabel && onTertiary && (
          <button className="secondary-button" onClick={onTertiary}>{tertiaryLabel}</button>
        )}
      </div>
    </section>
  );
}

function readableError(error) {
  if (!error) {
    return "Something went wrong.";
  }

  if (error.status) {
    return `${error.status}: ${error.message}`;
  }

  return error.message || "Something went wrong.";
}
