type GitHubAvatarProps = {
  username: string;
  size?: number; // Optional size in pixels
};

function GitHubAvatar({ username, size = 100 }: GitHubAvatarProps) {
  const imageUrl = `https://github.com/${username}.png?size=${size}`;

  return (
    <img
      className="rounded-full border border-gray-800 shadow-sm animate-fade-in overflow-hidden"
      src={imageUrl}
      alt={`${username}'s GitHub avatar`}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover' }}
    />
  );
};

export default GitHubAvatar;