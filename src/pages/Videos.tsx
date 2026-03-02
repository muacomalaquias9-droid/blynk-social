import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import VideoItem from '@/components/VideoItem'; // Preserved real import

const Videos = () => {
    const [videos, setVideos] = useState([]);

    useEffect(() => {
        const fetchVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*');

            if (error) console.error('Error fetching videos:', error);
            else setVideos(data);
        };

        fetchVideos();
    }, []);

    return (
        <div>
            <h1>My Videos</h1>
            {videos.length > 0 ? (
                <div>
                    {videos.map((video) => (
                        <VideoItem key={video.id} video={video} />
                    ))}
                </div>
            ) : (
                <p>No videos available</p>
            )}
        </div>
    );
};

export default Videos;