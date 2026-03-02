import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Video {
  id: string;
  title: string;
  url: string;
  description?: string;
  created_at?: string;
}

const Videos = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data, error: supabaseError } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;
        setVideos(data || []);
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar vídeos');
        console.error('Error fetching videos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) return <div className="p-4">Carregando...</div>;
  if (error) return <div className="p-4 text-red-500">Erro: {error}</div>;
  if (videos.length === 0) return <div className="p-4">Nenhum vídeo disponível</div>;

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Meus Vídeos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map(video => (
          <div key={video.id} className="rounded-lg overflow-hidden shadow-lg">
            <video controls className="w-full h-48 bg-black">
              <source src={video.url} type="video/mp4" />
              Seu navegador não suporta o elemento de vídeo.
            </video>
            <div className="p-3">
              <h2 className="font-bold text-lg">{video.title}</h2>
              {video.description && (
                <p className="text-sm text-gray-600 mt-1">{video.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Videos;