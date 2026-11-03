// A shop's status comes from the community vote balance.
export const countVotes = (shop) => ({
  upvotes: shop?.upvotes || 0,
  downvotes: shop?.downvotes || 0
});

export const getDerivedStatus = (shop) => {
  const { upvotes, downvotes } = countVotes(shop);
  if (upvotes > downvotes) return 'specialty';
  if (downvotes > upvotes) return 'fake';
  return 'unverified';
};
