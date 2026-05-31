import { useState, useEffect } from 'react';
import { recordsAPI } from '../api/client';
import RecordCard from '../components/RecordCard';
import './Catalog.css';

const GENRES = ['All', 'Jazz', 'Rock', 'Pop', 'Electronic', 'Folk', 'Blues', 'Soul', 'Hip-Hop', 'Alternative', 'Progressive Rock', 'Folk Rock'];

export default function Catalog() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('All');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (genre !== 'All') params.genre = genre;

    const timer = setTimeout(() => {
      recordsAPI.getAll(params)
        .then(({ data }) => setRecords(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, genre]);

  return (
    <div className="catalog">
      <div className="catalog__hero">
        <h1>Discover Vinyl</h1>
        <p>Rare records, timeless classics, and everything in between</p>
      </div>

      <div className="catalog__filters">
        <input
          className="input catalog__search"
          placeholder="Search by title or artist…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="catalog__genres">
          {GENRES.map((g) => (
            <button
              key={g}
              className={`genre-pill ${genre === g ? 'genre-pill--active' : ''}`}
              onClick={() => setGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="catalog__loading">Loading records…</div>
      ) : records.length === 0 ? (
        <div className="catalog__empty">No records found. Try a different filter.</div>
      ) : (
        <div className="catalog__grid">
          {records.map((r) => <RecordCard key={r.recordId} record={r} />)}
        </div>
      )}
    </div>
  );
}
