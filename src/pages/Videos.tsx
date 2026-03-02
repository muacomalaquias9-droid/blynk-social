import React from 'react';

const Videos = () => {
  const videos = [
    // list of video objects here
  ];

  return (
    <div>
      {videos.map(video => (
        <div key={video.id}>
          <h2>{video.title}</h2>
          <video src={video.src} controls />
        </div>
      ))}
    </div>
  );
};

export default Videos;