import React, { useEffect, useState } from 'react';

type RepoPhotoProps = {
  repoFullName: string;
};

const RepoPhoto: React.FC<RepoPhotoProps> = ({ repoFullName }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${repoFullName}`);
        if (!res.ok) throw new Error('Repo not found');
        const data = await res.json();
        setAvatarUrl(data.owner.avatar_url);
        setRepoUrl(data.html_url);
      } catch (err) {
        console.error(err);
        setAvatarUrl(null);
      }
    };

    fetchRepoData();
  }, [repoFullName]);

  if (!avatarUrl) return <div>Loading...</div>;

  return (
    <a href={repoUrl || '#'} target="_blank" rel="noopener noreferrer">
      <img
        src={avatarUrl}
        alt={`${repoFullName} owner avatar`}
        style={{ width: 60, height: 60, borderRadius: '50%' }}
      />
    </a>
  );
};

export default RepoPhoto;