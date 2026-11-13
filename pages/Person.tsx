import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPerson, getPersonCredits } from '../services/tmdb';
import { TMDBResult, PersonDetail } from '../types';
import { TMDB_POSTER_BASE, AVATAR_FALLBACK_SVG } from '../constants';
import { MediaCard } from '../components/MediaCard';
import { Skeleton } from '../components/Skeleton';
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
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
        <Skeleton width={100} height={20} className="mb-6 rounded-md" />
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <Skeleton className="w-48 md:w-72 aspect-[2/3] rounded-xl shrink-0 mx-auto md:mx-0" />
          <div className="flex-1 space-y-4">
            <Skeleton width="55%" height={44} className="rounded-lg" />
            <div className="flex gap-6">
              <Skeleton width={140} height={18} className="rounded-md" />
              <Skeleton width={180} height={18} className="rounded-md" />
            </div>
            <Skeleton width="30%" height={18} className="rounded-md" />
            <Skeleton height={16} className="rounded-md" />
            <Skeleton height={16} className="rounded-md" />
            <Skeleton height={16} width="70%" className="rounded-md" />
          </div>
        </div>
        <Skeleton width={160} height={30} className="mb-6 rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] w-full rounded-2xl mb-2" />
              <Skeleton width="80%" height={14} className="rounded-md" />
              <Skeleton width="50%" height={12} className="rounded-md mt-1" />
            </div>
          ))}
        </div>
      </div>
    );
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