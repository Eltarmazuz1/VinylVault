import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ratingsAPI, purchasesAPI, recordsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import RecordCard from '../components/RecordCard';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ratings, setRatings] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchasedRecords, setPurchasedRecords] = useState([]);
  const [tab, setTab] = useState('purchases');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/'); return; }

    Promise.all([
      ratingsAPI.getForUser(user.userId),
      purchasesAPI.getMyPurchases(),
    ]).then(async ([{ data: rats }, { data: purch }]) => {
      setRatings(rats);
      setPurchases(purch);

      const records = await Promise.all(
        purch.map((p) => recordsAPI.getOne(p.recordId).then(({ data }) => data).catch(() => null))
      );
      setPurchasedRecords(records.filter(Boolean));
    }).finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;
  if (loading) return <div className="profile-loading">Loading your collection…</div>;

  return (
    <div className="profile">
      <div className="profile__header">
        <h1>My Collection</h1>
        <p className="profile__email">{user.email}</p>
      </div>

      <div className="profile__stats">
        <div className="stat">
          <span className="stat__value">{purchases.length}</span>
          <span className="stat__label">Records Owned</span>
        </div>
        <div className="stat">
          <span className="stat__value">{ratings.length}</span>
          <span className="stat__label">Ratings Given</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {ratings.length ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1) : '—'}
          </span>
          <span className="stat__label">Avg Rating</span>
        </div>
      </div>

      <div className="profile__tabs">
        <button className={`tab ${tab === 'purchases' ? 'tab--active' : ''}`} onClick={() => setTab('purchases')}>
          My Records ({purchases.length})
        </button>
        <button className={`tab ${tab === 'ratings' ? 'tab--active' : ''}`} onClick={() => setTab('ratings')}>
          My Ratings ({ratings.length})
        </button>
      </div>

      {tab === 'purchases' && (
        purchasedRecords.length === 0 ? (
          <p className="profile__empty">No records in your collection yet. Browse the catalog!</p>
        ) : (
          <div className="profile__grid">
            {purchasedRecords.map((r) => <RecordCard key={r.recordId} record={r} />)}
          </div>
        )
      )}

      {tab === 'ratings' && (
        ratings.length === 0 ? (
          <p className="profile__empty">You haven't rated any records yet.</p>
        ) : (
          <div className="ratings-list">
            {ratings.map((r) => (
              <div key={r.ratingId} className="rating-row" onClick={() => navigate(`/records/${r.recordId}`)}>
                <div>
                  <StarRating value={r.score} readonly size="sm" />
                  {r.review && <p className="rating-row__review">{r.review}</p>}
                </div>
                <span className="rating-row__date">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
