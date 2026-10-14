/**
 * Seeds demo data: an admin, an organizer, 20 buyers and a few published events.
 *
 *   npm run seed            # add demo data (skips if it already exists)
 *   npm run seed -- --reset # DROP the database first, then seed
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import '../src/config/models.js';
import { bumpVersion } from '../src/common/cache.js';
import { connectMongo, disconnectMongo } from '../src/config/db.js';
import { connectRedis, redis } from '../src/config/redis.js';
import { env } from '../src/config/env.js';
import { createEvent } from '../src/modules/events/event.service.js';
import { Event } from '../src/modules/events/event.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Venue } from '../src/modules/venues/venue.model.js';

const reset = process.argv.includes('--reset');

const PASSWORDS = { admin: 'Admin@12345', organizer: 'Organizer@123', buyer: 'Buyer@12345' };
const daysFromNow = (d, hour = 19) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function makeUser(name, email, role, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ name, email, role, passwordHash, isVerified: true });
}

async function main() {
  if (reset && env.NODE_ENV === 'production') throw new Error('Refusing to --reset a production database');
  await connectMongo();
  await connectRedis();

  if (reset) {
    await mongoose.connection.dropDatabase();
    console.log('Database dropped');
    // Make sure indexes (notably the unique booked-seat index) exist again.
    const results = await Promise.allSettled(Object.values(mongoose.models).map((m) => m.syncIndexes()));
    results.forEach((r, i) => r.status === 'rejected' && console.warn(`  index sync warning (${Object.keys(mongoose.models)[i]}): ${r.reason.message}`));
  } else if (await User.exists({ email: 'admin@tickethub.dev' })) {
    console.log('Seed data already present. Use --reset to start over.');
    return;
  }

  const admin = await makeUser('Admin', 'admin@tickethub.dev', 'admin', PASSWORDS.admin);
  const organizer = await makeUser('Olivia Organizer', 'organizer@tickethub.dev', 'organizer', PASSWORDS.organizer);
  for (let i = 1; i <= 20; i += 1) {
    await makeUser(`Buyer ${i}`, `buyer${i}@tickethub.dev`, 'user', PASSWORDS.buyer);
  }

  const venues = await Venue.insertMany([
    {
      name: 'Grand Arena', city: 'Ahmedabad', address: 'SG Highway', createdBy: organizer._id,
      layout: { sections: [
        { name: 'VIP', rows: 4, cols: 10, tier: 'Gold' },
        { name: 'Premium', rows: 6, cols: 12, tier: 'Silver' },
        { name: 'General', rows: 8, cols: 14, tier: 'Bronze' },
      ] },
    },
    {
      name: 'Skyline Theatre', city: 'Mumbai', address: 'Bandra West', createdBy: organizer._id,
      layout: { sections: [
        { name: 'Stalls', rows: 10, cols: 16, tier: 'Standard' },
        { name: 'Balcony', rows: 6, cols: 16, tier: 'Premium' },
      ] },
    },
    {
      name: 'The Comedy Cellar', city: 'Bengaluru', address: 'Indiranagar', createdBy: organizer._id,
      layout: { sections: [{ name: 'Floor', rows: 6, cols: 10, tier: 'Standard' }] },
    },
  ]);
  const [arena, theatre, cellar] = venues;

  const plans = [
    { title: 'Indie Nights Live', category: 'concert', venue: arena, day: 14, tiers: [['Gold', 2500], ['Silver', 1500], ['Bronze', 800]],
      description: 'Three of the best indie bands under one roof for a night of live music.' },
    { title: 'Premier League Screening', category: 'sports', venue: arena, day: 21, tiers: [['Gold', 1800], ['Silver', 1000], ['Bronze', 500]],
      description: 'Watch the big match on a giant screen with fellow fans.' },
    { title: 'Hamlet - A Modern Retelling', category: 'theatre', venue: theatre, day: 30, tiers: [['Standard', 700], ['Premium', 1400]],
      description: 'A contemporary staging of Shakespeare\'s classic tragedy.' },
    { title: 'Stand-up Saturday', category: 'comedy', venue: cellar, day: 9, tiers: [['Standard', 400]],
      description: 'An intimate evening of stand-up from the city\'s funniest comics.' },
  ];

  for (const p of plans) {
    const event = await createEvent(
      { id: String(organizer._id), role: 'organizer' },
      {
        title: p.title,
        description: p.description,
        category: p.category,
        startsAt: daysFromNow(p.day),
        venueId: String(p.venue._id),
        pricingTiers: p.tiers.map(([name, price]) => ({ name, price })),
      },
    );
    await Event.updateOne({ _id: event._id }, { status: 'published' });
    console.log(`  event: ${p.title} (${event.totalSeats} seats) -> ${event.id}`);
  }
  await bumpVersion('events');

  console.log(`
Seeded. Log in with:
  admin      admin@tickethub.dev       ${PASSWORDS.admin}
  organizer  organizer@tickethub.dev   ${PASSWORDS.organizer}
  buyers     buyer1..buyer20@tickethub.dev   ${PASSWORDS.buyer}
`);
  void admin;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo().catch(() => {});
    redis.disconnect();
  });
