-- Demo Reviews Seed Data
-- 50+ realistic reviews for demo purposes
-- Run this after creating a tenant to populate demo data

-- NOTE: Replace 'YOUR_TENANT_ID' with the actual tenant UUID before running
-- You can find your tenant ID by running: SELECT id FROM tenants WHERE slug = 'your-tenant-slug';

-- Variable substitution (run SET session first)
-- SET session my.tenant_id = 'your-actual-tenant-id';

-- ============================================================================
-- POSITIVE REVIEWS (5 stars) - 20 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT
    t.id,
    'google',
    'Sarah M.',
    5,
    'Absolutely phenomenal dining experience! The truffle mushroom bruschetta was heavenly, and the grilled salmon melted in my mouth. Our server was attentive without being intrusive. Will definitely be back!',
    NOW() - INTERVAL '2 days',
    'positive',
    0.95,
    '["truffle mushroom bruschetta", "grilled salmon", "attentive service", "dining experience"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'James Wilson', 5,
    'Best restaurant in the area! The menu has such variety, and everything is made fresh. The chocolate lava cake is a must-try dessert. Prices are reasonable for the quality.',
    NOW() - INTERVAL '3 days', 'positive', 0.92,
    '["best restaurant", "fresh ingredients", "chocolate lava cake", "reasonable prices"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Emily Chen', 5,
    'My new favorite spot! The ambiance is perfect for date night. We tried the duck breast and it was cooked to perfection. The wine selection is impressive too.',
    NOW() - INTERVAL '4 days', 'positive', 0.91,
    '["date night", "duck breast", "wine selection", "ambiance"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Robert Brown', 5,
    'Outstanding food and service! We celebrated our anniversary here and the staff made it extra special. The lobster bisque was the best Ive ever had.',
    NOW() - INTERVAL '5 days', 'positive', 0.94,
    '["anniversary", "lobster bisque", "special occasion", "outstanding service"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Lisa Anderson', 5,
    'Hidden gem! We stumbled upon this place and were blown away. The Caesar salad had the perfect dressing, and the portions are generous. Highly recommend!',
    NOW() - INTERVAL '6 days', 'positive', 0.89,
    '["hidden gem", "Caesar salad", "generous portions", "highly recommend"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Michael Davis', 5,
    'Took my family here for Sunday brunch - everyone loved it! Kids menu is fantastic and the staff were so patient with our little ones. Great family restaurant.',
    NOW() - INTERVAL '7 days', 'positive', 0.90,
    '["family friendly", "Sunday brunch", "kids menu", "patient staff"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Jennifer Taylor', 5,
    'The attention to detail here is incredible. Every dish is presented beautifully. Had the pan-seared duck and it was restaurant-quality at its finest!',
    NOW() - INTERVAL '8 days', 'positive', 0.93,
    '["attention to detail", "beautiful presentation", "pan-seared duck", "restaurant quality"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'David Martinez', 5,
    'Ive been coming here for years and the quality never drops. The salmon is always fresh and perfectly seasoned. This is my go-to recommendation for visitors.',
    NOW() - INTERVAL '9 days', 'positive', 0.88,
    '["consistent quality", "fresh salmon", "go-to recommendation", "regular customer"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Amanda White', 5,
    'Celebrated my birthday here and they made it so special with a complimentary dessert and candle! The steak was perfect medium-rare. Five stars all around!',
    NOW() - INTERVAL '10 days', 'positive', 0.96,
    '["birthday celebration", "complimentary dessert", "perfect steak", "special treatment"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Christopher Lee', 5,
    'As a foodie, I have high standards - and this place exceeded them all. The creative menu items and impeccable execution make this a must-visit destination.',
    NOW() - INTERVAL '11 days', 'positive', 0.91,
    '["foodie approved", "creative menu", "impeccable execution", "must-visit"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Stephanie Moore', 5,
    'The lunchtime special is unbeatable value! Quick service during busy hours and the food quality remains top-notch. Perfect for business lunches.',
    NOW() - INTERVAL '12 days', 'positive', 0.87,
    '["lunch special", "great value", "quick service", "business lunch"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Daniel Jackson', 5,
    'Vegetarian options here are fantastic! Finally a restaurant that takes plant-based dining seriously. The veggie pasta was incredible.',
    NOW() - INTERVAL '13 days', 'positive', 0.89,
    '["vegetarian options", "plant-based", "veggie pasta", "dietary accommodating"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Rachel Thompson', 5,
    'Gluten-free options galore! As a celiac, I rarely feel safe eating out, but the staff here were incredibly knowledgeable about allergens.',
    NOW() - INTERVAL '14 days', 'positive', 0.90,
    '["gluten-free", "allergen aware", "celiac friendly", "knowledgeable staff"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Matthew Garcia', 5,
    'The cocktail menu deserves its own review! Creative drinks paired perfectly with the appetizers. The truffle fries are addictive!',
    NOW() - INTERVAL '15 days', 'positive', 0.88,
    '["cocktail menu", "creative drinks", "truffle fries", "appetizers"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Ashley Robinson', 5,
    'Brought my parents from out of town and they were amazed. The classic dishes are executed perfectly. Mom said the roast chicken reminded her of home cooking, but better!',
    NOW() - INTERVAL '16 days', 'positive', 0.92,
    '["classic dishes", "roast chicken", "family dinner", "home cooking"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Brandon Clark', 5,
    'The outdoor patio seating is gorgeous! Perfect for warm evenings. We spent hours enjoying appetizers and wine watching the sunset. Romantic and delicious!',
    NOW() - INTERVAL '17 days', 'positive', 0.91,
    '["outdoor patio", "romantic", "sunset dining", "wine selection"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Nicole Walker', 5,
    'Ordered takeout and it arrived hot and well-packaged. The food travels really well and tastes just as good as dining in. Great option for movie nights at home!',
    NOW() - INTERVAL '18 days', 'positive', 0.85,
    '["takeout", "well-packaged", "hot food", "movie night"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Kevin Hall', 5,
    'Reserved for a work team dinner and they handled our group of 15 flawlessly. Pre-ordered menu worked perfectly and everyone raved about their meals.',
    NOW() - INTERVAL '19 days', 'positive', 0.89,
    '["group dining", "work dinner", "large party", "pre-ordered menu"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Laura Young', 5,
    'The tasting menu was an experience! Every course was thoughtfully prepared and paired with excellent wines. Worth every penny for a special occasion.',
    NOW() - INTERVAL '20 days', 'positive', 0.95,
    '["tasting menu", "wine pairing", "special occasion", "worth it"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Jason King', 5,
    'Finally found my new regular spot! The bartender remembers my drink, the kitchen knows my usual - this place feels like home. Community-oriented restaurant at its best.',
    NOW() - INTERVAL '21 days', 'positive', 0.93,
    '["regular spot", "community feel", "personal service", "like home"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- POSITIVE REVIEWS (4 stars) - 15 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Patricia Wright', 4,
    'Great food, excellent service. Only reason for 4 stars instead of 5 is the parking situation - can be tricky on weekends. But definitely worth the effort!',
    NOW() - INTERVAL '22 days', 'positive', 0.78,
    '["great food", "excellent service", "parking issues", "weekend busy"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Richard Lopez', 4,
    'Solid restaurant with consistent quality. The menu could use a few more options for pescatarians, but what they do have is excellent.',
    NOW() - INTERVAL '23 days', 'positive', 0.75,
    '["consistent quality", "limited pescatarian", "excellent dishes", "solid choice"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Susan Hill', 4,
    'Lovely meal overall. The appetizers were the stars of the show - could have eaten three orders of the bruschetta! Main course was good but not quite as memorable.',
    NOW() - INTERVAL '24 days', 'positive', 0.73,
    '["great appetizers", "bruschetta", "good main course", "lovely meal"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Mark Scott', 4,
    'Really enjoyed our dinner. The noise level was a bit high on Saturday night which made conversation difficult, but the food more than made up for it.',
    NOW() - INTERVAL '25 days', 'positive', 0.71,
    '["enjoyed dinner", "noise level", "Saturday busy", "great food"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Elizabeth Green', 4,
    'Food was fantastic, service was friendly but a bit slow during the rush. Would still recommend, just maybe not when youre in a hurry.',
    NOW() - INTERVAL '26 days', 'positive', 0.72,
    '["fantastic food", "slow service", "rush hour", "recommend"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Thomas Adams', 4,
    'Very good restaurant with high-quality ingredients. Portions are on the smaller side for the price, but the taste is undeniable. Fine dining without the pretense.',
    NOW() - INTERVAL '27 days', 'positive', 0.76,
    '["high-quality", "smaller portions", "fine dining", "great taste"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Margaret Baker', 4,
    'Delicious meal and beautiful presentation. Would have been 5 stars but our reservation was pushed back 15 minutes. Still a wonderful experience overall.',
    NOW() - INTERVAL '28 days', 'positive', 0.74,
    '["delicious", "beautiful presentation", "reservation delay", "wonderful experience"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Steven Nelson', 4,
    'Great spot for a nice dinner. The sommelier gave excellent wine recommendations. Dessert menu is a bit limited but what they offer is superb.',
    NOW() - INTERVAL '29 days', 'positive', 0.77,
    '["nice dinner", "sommelier", "wine recommendations", "limited desserts"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Dorothy Carter', 4,
    'Really tasty food with fresh ingredients. The AC was a bit cold inside, so bring a sweater if you run cold! Otherwise, a lovely dining experience.',
    NOW() - INTERVAL '30 days', 'positive', 0.70,
    '["tasty food", "fresh ingredients", "cold AC", "lovely experience"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Paul Mitchell', 4,
    'Had a great birthday dinner here. Food was excellent, ambiance was nice. Only minor note - the music was a bit loud for intimate conversation.',
    NOW() - INTERVAL '31 days', 'positive', 0.75,
    '["birthday dinner", "excellent food", "loud music", "nice ambiance"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Karen Roberts', 4,
    'Dependable restaurant with quality food. Not cutting edge or trendy, but executes the classics really well. Solid choice for any occasion.',
    NOW() - INTERVAL '32 days', 'positive', 0.73,
    '["dependable", "quality food", "classics", "solid choice"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Ronald Turner', 4,
    'Very pleasant meal. The salmon was cooked perfectly. Service was professional. Could improve the bread basket selection - its a bit basic.',
    NOW() - INTERVAL '33 days', 'positive', 0.72,
    '["pleasant meal", "perfect salmon", "professional service", "basic bread"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Betty Phillips', 4,
    'Enjoyable evening out. The seafood selection is impressive. Would like to see more vegetarian mains on the menu, but the ones available were good.',
    NOW() - INTERVAL '34 days', 'positive', 0.71,
    '["enjoyable evening", "seafood", "vegetarian options", "impressive selection"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Edward Campbell', 4,
    'Good value for money. The lunch special is particularly good. Dinner prices are higher but justified by the quality. Would recommend trying the specials.',
    NOW() - INTERVAL '35 days', 'positive', 0.74,
    '["good value", "lunch special", "quality justified", "daily specials"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Helen Parker', 4,
    'Nice neighborhood restaurant. Staff is friendly and remembers regulars. The menu hasnt changed much over the years, which is both good and bad.',
    NOW() - INTERVAL '36 days', 'positive', 0.70,
    '["neighborhood restaurant", "friendly staff", "consistent menu", "regulars welcome"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- NEUTRAL REVIEWS (3 stars) - 10 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Frank Evans', 3,
    'Decent food but nothing extraordinary. The prices seem a bit high for what you get. Service was okay, not particularly memorable in either direction.',
    NOW() - INTERVAL '37 days', 'neutral', 0.30,
    '["decent food", "high prices", "okay service", "not memorable"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Virginia Edwards', 3,
    'Mixed experience. Some dishes were great (loved the appetizers), others were underwhelming (the pasta was overcooked). Hit or miss depending on what you order.',
    NOW() - INTERVAL '38 days', 'neutral', 0.35,
    '["mixed experience", "great appetizers", "overcooked pasta", "hit or miss"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'George Collins', 3,
    'Average restaurant experience. Nothing wrong per se, but nothing that would make me rush back either. Plenty of other options in the area.',
    NOW() - INTERVAL '39 days', 'neutral', 0.25,
    '["average experience", "nothing special", "other options", "wont rush back"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Martha Stewart', 3,
    'The food was fine, portions are generous. However, we waited 45 minutes for our entrees which put a damper on the evening. When it arrived, it was lukewarm.',
    NOW() - INTERVAL '40 days', 'neutral', 0.20,
    '["fine food", "generous portions", "long wait", "lukewarm food"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Raymond Morris', 3,
    'Good location and nice decor. The food quality varied - some items excellent, others needed work. With some consistency, this could be a great spot.',
    NOW() - INTERVAL '41 days', 'neutral', 0.40,
    '["good location", "nice decor", "inconsistent quality", "potential"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Marie Rogers', 3,
    'Went with high expectations based on other reviews. Perhaps we went on an off night, but the experience didnt match the hype. Would try again.',
    NOW() - INTERVAL '42 days', 'neutral', 0.35,
    '["high expectations", "off night", "didnt match hype", "try again"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Jerry Reed', 3,
    'Not bad, not great. The chicken was dry, but the sides were tasty. Server was pleasant. Probably wouldnt go out of my way to return.',
    NOW() - INTERVAL '43 days', 'neutral', 0.28,
    '["dry chicken", "tasty sides", "pleasant server", "wont go out of way"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Catherine Cook', 3,
    'Standard fare at above-average prices. Theres nothing wrong with the restaurant, but I expected more based on what we paid. Adequate for a casual dinner.',
    NOW() - INTERVAL '44 days', 'neutral', 0.32,
    '["standard fare", "above-average prices", "expected more", "adequate"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Henry Morgan', 3,
    'The menu looks exciting but execution didnt quite deliver. Some creative ideas that fall a bit flat in practice. Room for improvement.',
    NOW() - INTERVAL '45 days', 'neutral', 0.30,
    '["exciting menu", "poor execution", "creative ideas", "room for improvement"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Ann Bell', 3,
    'Decent option for the neighborhood. Nothing to write home about, but reliable for a quick bite. The staff seemed understaffed during our visit.',
    NOW() - INTERVAL '46 days', 'neutral', 0.25,
    '["neighborhood option", "nothing special", "understaffed", "quick bite"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- NEGATIVE REVIEWS (2 stars) - 5 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Walter Murphy', 2,
    'Disappointed with our experience. Made a reservation but still waited 30 minutes for a table. Food was average when it finally arrived. Not worth the hassle.',
    NOW() - INTERVAL '47 days', 'negative', -0.45,
    '["disappointed", "long wait", "reservation issues", "average food"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Jean Bailey', 2,
    'Overpriced and underwhelming. The steak I ordered medium came out well-done. When I mentioned it, the server seemed indifferent. Wont be returning.',
    NOW() - INTERVAL '48 days', 'negative', -0.55,
    '["overpriced", "overcooked steak", "indifferent service", "wont return"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Carl Cooper', 2,
    'Had higher hopes based on reviews. The fish was clearly not fresh, and the vegetables were overcooked. Presentation was nice but cant eat presentation.',
    NOW() - INTERVAL '49 days', 'negative', -0.50,
    '["not fresh fish", "overcooked vegetables", "nice presentation", "disappointing"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Ruth Richardson', 2,
    'Service was our main issue. Our server forgot our appetizer order entirely, then brought the wrong entrees. Manager apologized but the damage was done.',
    NOW() - INTERVAL '50 days', 'negative', -0.48,
    '["poor service", "forgotten order", "wrong entrees", "management apology"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Jack Cox', 2,
    'Used to be great but quality has declined. Portion sizes are smaller, prices are higher, and the attention to detail is gone. Sad to see.',
    NOW() - INTERVAL '51 days', 'negative', -0.52,
    '["quality declined", "smaller portions", "higher prices", "lost detail"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- NEGATIVE REVIEWS (1 star) - 5 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Willie Howard', 1,
    'Terrible experience. Found a hair in my soup and when I complained, the manager was dismissive. No apology, no discount, nothing. Avoid this place.',
    NOW() - INTERVAL '52 days', 'negative', -0.85,
    '["hair in food", "dismissive manager", "no apology", "avoid"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'yelp', 'Harold Ward', 1,
    'Food poisoning from the seafood. Spent the next day sick. Reported to health department. Absolutely do not eat here if you value your health.',
    NOW() - INTERVAL '53 days', 'negative', -0.95,
    '["food poisoning", "seafood", "health department", "dangerous"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'tripadvisor', 'Shirley Torres', 1,
    'Waited over an hour for food that never came. Server kept saying "5 more minutes" for 40 minutes straight. Finally left and went elsewhere. Unacceptable.',
    NOW() - INTERVAL '54 days', 'negative', -0.80,
    '["hour wait", "food never came", "kept waiting", "walked out"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'google', 'Eugene Peterson', 1,
    'Bait and switch on pricing. Menu showed one price, bill had another. When I pointed it out, they claimed menu prices were "outdated". Shady practice.',
    NOW() - INTERVAL '55 days', 'negative', -0.78,
    '["pricing issues", "bait and switch", "outdated menu", "shady practice"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords)
SELECT t.id, 'facebook', 'Gloria Gray', 1,
    'Rudest staff Ive ever encountered. Asked a simple question about allergens and was treated like a nuisance. Will never give them my money again.',
    NOW() - INTERVAL '56 days', 'negative', -0.82,
    '["rude staff", "allergen concerns ignored", "poor treatment", "never again"]'::jsonb
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- AI-RESPONDED REVIEWS (samples with response) - 5 reviews
-- ============================================================================

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords, response_text, response_generated_by, response_ai_provider, response_date)
SELECT t.id, 'google', 'Anna Foster', 5,
    'Perfect anniversary dinner! The staff went above and beyond to make our evening special. The champagne toast they arranged was such a lovely touch.',
    NOW() - INTERVAL '3 days', 'positive', 0.96,
    '["anniversary dinner", "above and beyond", "champagne toast", "special"]'::jsonb,
    'Dear Anna, thank you so much for celebrating your anniversary with us! It was our absolute pleasure to be part of your special evening. We''re delighted the champagne toast added to the celebration. Wishing you many more happy years together, and we hope to see you again soon for another milestone!',
    'ai',
    'claude',
    NOW() - INTERVAL '2 days'
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords, response_text, response_generated_by, response_ai_provider, response_date)
SELECT t.id, 'yelp', 'Peter Hayes', 4,
    'Great meal overall. The risotto was creamy and perfectly cooked. Only suggestion would be to update the wine list - some selections are a bit dated.',
    NOW() - INTERVAL '5 days', 'positive', 0.75,
    '["great meal", "perfect risotto", "wine list", "suggestion"]'::jsonb,
    'Hi Peter, thank you for the wonderful feedback on our risotto - it''s one of our chef''s proudest dishes! We appreciate your thoughtful suggestion about our wine list and will be reviewing it with our sommelier. We''re always looking to improve, and input like yours helps us do exactly that. We hope to welcome you back soon!',
    'ai',
    'openai',
    NOW() - INTERVAL '4 days'
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords, response_text, response_generated_by, response_ai_provider, response_date)
SELECT t.id, 'tripadvisor', 'Diana Powell', 3,
    'Food was okay but service was slow. Took 20 minutes just to get our drink order. The restaurant wasnt even that busy. Room for improvement.',
    NOW() - INTERVAL '7 days', 'neutral', 0.28,
    '["slow service", "drink order delay", "not busy", "improvement needed"]'::jsonb,
    'Dear Diana, thank you for taking the time to share your experience. We sincerely apologize for the slow service during your visit - this doesn''t reflect our standards. We''ve shared your feedback with our team and are taking steps to ensure more attentive service. We''d love the opportunity to provide you with the experience you deserve. Please reach out to us directly for a complimentary appetizer on your next visit.',
    'ai',
    'claude',
    NOW() - INTERVAL '6 days'
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords, response_text, response_generated_by, response_ai_provider, response_date)
SELECT t.id, 'google', 'Wayne Long', 2,
    'Expected more for the price. Steak was overcooked and sides were cold. Manager offered to remake it but by then the mood was ruined.',
    NOW() - INTERVAL '10 days', 'negative', -0.55,
    '["overpriced", "overcooked steak", "cold sides", "manager intervention"]'::jsonb,
    'Dear Wayne, we''re truly sorry your experience fell short of expectations. An overcooked steak and cold sides are simply unacceptable, and we understand why this affected your evening. While we''re glad our manager attempted to make things right, we recognize the damage was already done. We''d like to invite you back as our guest to show you the quality we''re known for. Please contact us directly, and we''ll arrange a special evening for you.',
    'ai',
    'openai',
    NOW() - INTERVAL '9 days'
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

INSERT INTO reviews (tenant_id, platform, reviewer_name, rating, review_text, review_date, sentiment, sentiment_score, keywords, response_text, response_generated_by, response_ai_provider, response_date)
SELECT t.id, 'facebook', 'Victor James', 1,
    'Appalling experience. Made a reservation for 8 people for my mothers birthday, arrived to find our table given away. Ruined the celebration.',
    NOW() - INTERVAL '14 days', 'negative', -0.90,
    '["reservation lost", "birthday ruined", "table given away", "group booking"]'::jsonb,
    'Dear Victor, we are deeply sorry for this unacceptable situation. Losing a reservation, especially for such an important occasion as your mother''s birthday, is inexcusable. We have investigated this matter and taken immediate steps to prevent this from ever happening again. We would be honored to host a proper celebration for your mother at no charge. Please contact our manager directly so we can make this right and give your mother the special day she deserves.',
    'ai',
    'claude',
    NOW() - INTERVAL '13 days'
FROM tenants t WHERE t.slug = (SELECT slug FROM tenants ORDER BY created_at DESC LIMIT 1);

-- Summary stats after running:
-- Total reviews: 55
-- 5-star: 20 (36%)
-- 4-star: 15 (27%)
-- 3-star: 10 (18%)
-- 2-star: 5 (9%)
-- 1-star: 5 (9%)
-- With AI responses: 5
-- Platforms: Google, Yelp, TripAdvisor, Facebook
