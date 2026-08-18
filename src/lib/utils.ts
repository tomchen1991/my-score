export const StarRating = (rating: number, maxStars: number = 5) => {
  const stars = [];
  for (let i = 1; i <= maxStars; i++) {
    const fill = i <= Math.floor(rating) ? '#FFD700' : 'white';
    const isHalfStar = i - 0.5 <= rating && rating < i;
    if (isHalfStar) {
      console.log('isHalfStar', isHalfStar);
      stars.push(`
        <div class="relative w-4 h-4">
          <svg class="absolute w-4 h-4" viewBox="0 0 24 24" fill="white" stroke="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <svg class="absolute w-4 h-4" viewBox="0 0 24 24" fill="#FFD700" stroke="currentColor" style="clip-path: inset(0 50% 0 0)">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      `);
    } else {
      stars.push(`
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      `);
    }
  }
  
  return stars.join('');
}