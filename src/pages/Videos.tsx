import React, { useEffect, useState } from 'react';
import { getVideos } from '../../api';

const Videos = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const fetchedVideos = await getVideos();
                setVideos(fetchedVideos);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div>
            <h1>Videos</h1>
            <ul>
                {videos.map(video => (
                    <li key={video.id}>
                        <h2>{video.title}</h2>
                        <video controls>
                            <source src={video.url} type="video/mp4"/>
                            Your browser does not support the video tag.
                        </video>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Videos;