# WSB:YOLO - Daily Paper Trading Championship

## Inspiration

As a huge fan of r/WallStreetBets, I wanted to create a fun, competitive way for the Reddit community to test their trading skills without risking real money. The idea was simple: give everyone a fresh start every day with $10,000 virtual cash and let them compete to see who can make the best trades by end of day. It's all about the thrill of trading, the competition, and proving you've got diamond hands! 🚀💎

## What it does

WSB:YOLO is a daily paper trading championship built as a Reddit game. Here's how it works:

- **Daily Reset**: Every player starts with $10,000 at market open
- **Real-Time Trading**: Trade stocks during weekdays and crypto on weekends using live market prices
- **Instant Execution**: Buy and sell with one-click quick trade buttons (Buy 1/10/Max, Sell 25%/50%/All)
- **Live Leaderboard**: Compete against other traders to reach the top spot
- **Trade History**: View your past trades and track your performance
- **Weekend Mode**: Automatically switches to crypto trading when stock markets are closed

The game resets daily, so everyone gets a fresh chance to climb the leaderboard!

## How we built it

**Tech Stack:**
- **Devvit Framework**: Reddit's platform for building interactive experiences
- **React**: Frontend UI with TypeScript
- **Vite**: Fast build tooling
- **TailwindCSS**: Modern, responsive styling
- **Yahoo Finance API**: Real-time stock and crypto price data
- **Redis**: Portfolio storage and leaderboard management

**Architecture:**
- Custom game logic for portfolio management, trade execution, and daily resets
- Real-time price polling every 3 seconds
- Fallback pricing system for API reliability
- Responsive design optimized for both mobile and desktop
- WSB-themed UI with smooth animations and visual feedback

## Challenges we ran into

1. **API Whitelisting**: Yahoo Finance API requires Reddit's approval for external HTTP requests. We implemented a robust fallback system with realistic price variations to ensure the game works during development.

2. **Daily Reset Logic**: Ensuring portfolios reset correctly at market open while handling weekends and different timezones required careful date/time handling in Eastern Time.

3. **Mobile Optimization**: Making the trading interface work smoothly on mobile devices required careful attention to touch targets, responsive layouts, and performance.

4. **Real-time Updates**: Balancing frequent price updates with performance and avoiding rate limits required implementing smart caching and polling strategies.

## Accomplishments that we're proud of

- **Polished UI**: Created a beautiful, WSB-themed interface with smooth animations, quick trade buttons, and intuitive design
- **Mobile-First**: Optimized touch targets and responsive layouts that work great on phones
- **Smart Fallback System**: Built a resilient pricing system that works even when APIs are unavailable
- **Weekend Trading**: Automatically switches between stocks and crypto based on market hours
- **Quick Trading**: One-click preset buttons make trading fast and fun
- **Visual Feedback**: Color-coded trade confirmations with auto-dismiss and smooth animations

## What we learned

- **Devvit Development**: Learned how to build interactive Reddit games using the Devvit framework and Web API
- **Financial Data Integration**: Gained experience working with real-time market data and handling API limitations
- **Game Design**: Balanced competitive elements with accessibility to create an engaging daily challenge
- **UX Polish**: Small details like animations, quick trade buttons, and visual feedback make a huge difference in user experience
- **Community Building**: Designed features (leaderboard, trade history) that encourage competition and engagement

## What's next for WSB:YOLO - Daily Paper Trading Championship

**Short-term:**
- Get Yahoo Finance API officially whitelisted for live data
- Add price history charts and sparklines
- Implement rank change indicators on the leaderboard
- Add user avatars and profiles

**Long-term:**
- **Weekly/Monthly Championships**: Extended competitions with bigger bragging rights
- **Portfolio Analytics**: Detailed stats showing win rate, best trades, and performance metrics
- **Social Features**: Share trades, comment on leaderboard positions, trash talk
- **Achievement System**: Badges for milestones (first profitable day, 10-day streak, etc.)
- **Advanced Trading**: Options, margin trading, and more complex strategies
- **Tournament Mode**: Special events with themed challenges

---

**Built for the Reddit Daily Games Hackathon** 🚀

*To the moon!* 💎🙌
