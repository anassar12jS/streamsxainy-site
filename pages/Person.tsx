import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPerson, getPersonCredits } from '../services/tmdb';
import { TMDBResult, PersonDetail } from '../types';
import { TMDB_POSTER_BASE, AVATAR_FALLBACK_SVG } from '../constants';
import { MediaCard } from '../components/MediaCard';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';

interface PersonProps {
  onSelect: (item: TMDBResult) => void;
}

export const Person: React.FC<PersonProps> = ({ onSelect }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const personId = parseInt(id || '0');

  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [credits, setCredits] = useState<TMDBResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) return;
    
    const fetch = async () => {
      setLoading(true);
      try {
        const [p, c] = await Promise.all([
          getPerson(personId),
          getPersonCredits(personId)
        ]);
        setDetail(p);
        setCredits(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    window.scrollTo(0,0);
  }, [personId]);

  if (loading || !detail) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--primary-color))]"></div></div>;
  }

  const profileUrl = detail.profile_path ? `${TMDB_POSTER_BASE}${detail.profile_path}` : AVATAR_FALLBACK_SVG;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      <div className="flex flex-col md:flex-row gap-8 mb-12">
        <div className="w-48 md:w-72 shrink-0 mx-auto md:mx-0 rounded-xl overflow-hidden shadow-2xl">
            <img src={profileUrl} alt={detail.name} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1">
            <h1 className="text-4xl font-bold text-[var(--text-main)] mb-4 text-center md:text-left">{detail.name}</h1>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-6 text-[var(--text-muted)] text-sm mb-6">
                {detail.birthday && (
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                        <span>{detail.birthday}</span>
                    </div>
                )}
                {detail.place_of_birth && (
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                        <span>{detail.place_of_birth}</span>
                    </div>
                )}
            </div>

            <h3 className="font-bold text-[var(--text-main)] mb-2">Biography</h3>
            <p className="text-[var(--text-muted)] leading-relaxed text-sm whitespace-pre-line">
                {detail.biography || 'No biography available.'}
            </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-[var(--text-main)] mb-6 border-b border-[var(--border-color)] pb-2">Known For</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
         {credits.map(item => (
             <MediaCard key={item.id} item={item} onClick={onSelect} />
         ))}
      </div>
    </div>
  );
};