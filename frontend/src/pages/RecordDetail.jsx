import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { recordsAPI, ratingsAPI, purchasesAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import './RecordDetail.css';

const PLACEHOLDER = 'https://placehold.co/400x400/1a1a1a/f5a623?text=♪';

export default function RecordDetail({ onRequestAuth }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [review, setReview] = useState('');
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      recordsAPI.getOne(id),
      ratingsAPI.getForRecord(id),
    ]).then(([{ data: rec }, { data: rats }]) => {
      setRecord(rec);
      setRatings(rats);
      if (user) {
        const mine = rats.find((r) => r.userId === user.userId);
        if (mine) { setUserRating(mine.score); setReview(mine.review || ''); }
      }
    }).finally(() => setLoading(false));
  }, [id, user]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const submitRating = async () => {
    if (!user) { onRequestAuth(); return; }
    if (!userRating) return;
    setSubmitting(true);
    try {
      await ratingsAPI.submit({ recordId: id, score: userRating, review });
      const { data: rats } = await ratingsAPI.getForRecord(id);
      setRatings(rats);
      const { data: rec } = await recordsAPI.getOne(id);
      setRecord(rec);
      showToast('Rating saved!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuy = async () => {
    if (!user) { onRequestAuth(); return; }
    setBuying(true);
    try {
      await purchasesAPI.buy({ recordId: id, price: record.price });
      setPurchased(true);
      showToast('Added to your collection!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <div className="detail-loading">Loading…</div>;
  if (!record) return <div className="detail-loading">Record not found.</div>;

  return (
    <div className="detail">
      {toast && <div className="toast">{toast}</div>}
      <button className="detail__back" onClick={() => navigate(-1)}>← Back</button>

      <div className="detail__main">
        <div className="detail__cover">
          <img
            src={record.imageUrl || PLACEHOLDER}
            alt={record.title}
            onError={(e) => { e.target.src = PLACEHOLDER; }}
          />
        </div>

        <div className="detail__info">
          <span className="detail__genre">{record.genre}</span>
          <h1 className="detail__title">{record.title}</h1>
          <h2 className="detail__artist">{record.artist}</h2>
          {record.year && <p className="detail__year">{record.year}</p>}
          <p className="detail__desc">{record.description}</p>

          <div className="detail__rating-summary">
            <StarRating value={record.avgRating || 0} readonly size="lg" />
            <span className="detail__rating-count">
              {record.avgRating ? `${record.avgRating} / 5` : 'No ratings yet'}
              {record.ratingCount > 0 && ` (${record.ratingCount} review${record.ratingCount !== 1 ? 's' : ''})`}
            </span>
          </div>

          <div className="detail__buy">
            <span className="detail__price">${Number(record.price).toFixed(2)}</span>
            <button
              className="btn btn--primary btn--lg"
              onClick={handleBuy}
              disabled={buying || purchased}
            >
              {purchased ? '✓ In Collection' : buying ? 'Adding…' : 'Add to Collection'}
            </button>
          </div>

          {record.tracklist?.length > 0 && (
            <div className="detail__tracklist">
              <h3>Tracklist</h3>
              <ol>
                {record.tracklist.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="detail__reviews">
        <h2>Ratings & Reviews</h2>

        <div className="review-form">
          <h3>Your Rating</h3>
          <StarRating value={userRating} onChange={setUserRating} size="lg" />
          <textarea
            className="input review-form__text"
            placeholder="Write a review (optional)…"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
          />
          <button className="btn btn--primary" onClick={submitRating} disabled={submitting || !userRating}>
            {submitting ? 'Saving…' : 'Submit Rating'}
          </button>
        </div>

        <div className="reviews-list">
          {ratings.length === 0 ? (
            <p className="reviews-empty">No reviews yet. Be the first!</p>
          ) : (
            ratings.map((r) => (
              <div key={r.ratingId} className="review-item">
                <StarRating value={r.score} readonly size="sm" />
                {r.review && <p className="review-item__text">{r.review}</p>}
                <span className="review-item__date">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
