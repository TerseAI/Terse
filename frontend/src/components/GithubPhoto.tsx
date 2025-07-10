import React from 'react';

type GitHubAvatarProps = {
  username: string;
  size?: number; // Optional size in pixels
};

const GitHubAvatar: React.FC<GitHubAvatarProps> = ({ username, size = 100 }) => {
  const imageUrl = `https://github.com/${username}.png?size=${size}`;

  return (
    <img
      src={imageUrl}
      alt={`${username}'s GitHub avatar`}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover' }}
    />
  );
};

export default GitHubAvatar;