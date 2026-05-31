import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import './RecordCard.css';

const PLACEHOLDER = 'https://placehold.co/300x300/1a1a1a/f5a623?text=♪';

export default function RecordCard({ record }) {
  return (
    <Link to={`/records/${record.recordId}`} className="record-card">
      <div className="record-card__cover">
        <img
          src={record.imageUrl || PLACEHOLDER}
          alt={record.title}
          onError={(e) => { e.target.src = PLACEHOLDER; }}
        />
        <div className="record-card__overlay">
          <span className="record-card__genre">{record.genre}</span>
        </div>
      </div>
      <div className="record-card__info">
        <h3 className="record-card__title">{record.title}</h3>
        <p className="record-card__artist">{record.artist}</p>
        <div className="record-card__footer">
          <StarRating value={record.avgRating || 0} readonly size="sm" />
          <span className="record-card__price">${Number(record.price).toFixed(2)}</span>
        </div>
      </div>
    </Link>
  );
}
