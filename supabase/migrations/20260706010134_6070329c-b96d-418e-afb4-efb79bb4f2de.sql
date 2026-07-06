
-- FIX 1: grants for Data API and add FK for feed embed
GRANT SELECT ON public.farms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farms TO authenticated;
GRANT ALL ON public.farms TO service_role;

GRANT SELECT ON public.plant_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_logs TO authenticated;
GRANT ALL ON public.plant_logs TO service_role;

GRANT SELECT ON public.timeline_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_updates TO authenticated;
GRANT ALL ON public.timeline_updates TO service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.update_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.update_comments TO authenticated;
GRANT ALL ON public.update_comments TO service_role;

GRANT SELECT ON public.update_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.update_likes TO authenticated;
GRANT ALL ON public.update_likes TO service_role;

-- Add FK from timeline_updates.user_id to profiles.id so PostgREST embed works
ALTER TABLE public.timeline_updates
  ADD CONSTRAINT timeline_updates_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ADD 2: plant profile fields
ALTER TABLE public.plant_logs
  ADD COLUMN IF NOT EXISTS estimated_age_years numeric,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS area_value numeric,
  ADD COLUMN IF NOT EXISTS area_unit text;

-- ADD 5: crop knowledge base
CREATE TABLE public.crop_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name text NOT NULL UNIQUE,
  growing_conditions text NOT NULL,
  lifecycle jsonb NOT NULL DEFAULT '[]'::jsonb,
  diseases jsonb NOT NULL DEFAULT '[]'::jsonb,
  region text NOT NULL DEFAULT 'Tropical Southeast Asia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crop_knowledge TO anon;
GRANT SELECT, INSERT, UPDATE ON public.crop_knowledge TO authenticated;
GRANT ALL ON public.crop_knowledge TO service_role;
ALTER TABLE public.crop_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crop knowledge readable by everyone" ON public.crop_knowledge FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert crop knowledge" ON public.crop_knowledge FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update crop knowledge" ON public.crop_knowledge FOR UPDATE TO authenticated USING (true);
CREATE TRIGGER update_crop_knowledge_updated_at BEFORE UPDATE ON public.crop_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crop_knowledge (crop_name, growing_conditions, lifecycle, diseases) VALUES
('Durian', 'Hot humid tropical climate 24-30°C; deep well-drained loamy soil pH 5.5-6.5; annual rainfall 1500-2000mm with a short dry spell to induce flowering; full sun; shelter from strong winds.',
 '[{"stage":"Soil Preparation","duration":"2-4 weeks"},{"stage":"Seed/Planting","duration":"Year 0"},{"stage":"Germination","duration":"2-4 weeks"},{"stage":"Transplant","duration":"6-12 months old seedling"},{"stage":"Vegetative","duration":"4-7 years"},{"stage":"Flowering","duration":"1-2 months"},{"stage":"Fruiting","duration":"3-4 months"},{"stage":"Harvest","duration":"Year 5-8 onward, annually"}]',
 '[{"name":"Phytophthora root and patch canker","symptoms":"Dark oozing lesions on trunk, wilting canopy, yellowing leaves.","prevention":"Ensure good drainage, avoid trunk injury, apply Trichoderma to soil, use phosphonate injections."},{"name":"Stem canker","symptoms":"Sunken bark, brown internal tissue.","prevention":"Prune and paint wounds with copper fungicide; keep base weed-free."},{"name":"Fruit borer","symptoms":"Holes and frass on developing fruit.","prevention":"Bag fruit at pea-size; sanitary field practices."}]'),
('Mango','Tropical/subtropical 24-30°C; well-drained sandy loam; distinct dry season triggers flowering; full sun.',
 '[{"stage":"Soil Preparation","duration":"2-4 weeks"},{"stage":"Seed/Planting","duration":"Year 0"},{"stage":"Germination","duration":"2-4 weeks"},{"stage":"Transplant","duration":"6 months"},{"stage":"Vegetative","duration":"3-5 years"},{"stage":"Flowering","duration":"1-2 months"},{"stage":"Fruiting","duration":"3-5 months"},{"stage":"Harvest","duration":"Annual after year 4"}]',
 '[{"name":"Anthracnose","symptoms":"Black spots on leaves, flowers and fruit; blossom blight.","prevention":"Copper or mancozeb sprays at flowering; prune for airflow."},{"name":"Powdery mildew","symptoms":"White powder on panicles.","prevention":"Sulfur sprays at early bloom."},{"name":"Fruit fly","symptoms":"Maggots inside fruit.","prevention":"Bagging, methyl-eugenol traps."}]'),
('Banana','Hot humid 26-30°C; deep fertile loam; abundant water; shelter from wind; full sun.',
 '[{"stage":"Soil Preparation","duration":"2-3 weeks"},{"stage":"Seed/Planting","duration":"Sucker planting"},{"stage":"Transplant","duration":"Sucker establishment 4-6 weeks"},{"stage":"Vegetative","duration":"6-8 months"},{"stage":"Flowering","duration":"1 month"},{"stage":"Fruiting","duration":"3-4 months"},{"stage":"Harvest","duration":"9-12 months from planting"}]',
 '[{"name":"Panama disease (Fusarium wilt TR4)","symptoms":"Yellow lower leaves, split pseudostem, brown vascular tissue.","prevention":"Use clean planting material; strict field hygiene; resistant cultivars."},{"name":"Sigatoka leaf spot","symptoms":"Brown streaks and spots on leaves.","prevention":"Remove infected leaves; fungicide rotation."},{"name":"Banana weevil","symptoms":"Tunneling in corm; toppling plants.","prevention":"Pheromone traps, clean suckers."}]'),
('Chilli','Warm 20-30°C; well-drained sandy loam pH 6-7; full sun; moderate water, avoid waterlogging.',
 '[{"stage":"Soil Preparation","duration":"1-2 weeks"},{"stage":"Seed/Planting","duration":"Nursery"},{"stage":"Germination","duration":"7-14 days"},{"stage":"Transplant","duration":"4-6 weeks after sowing"},{"stage":"Vegetative","duration":"4-6 weeks"},{"stage":"Flowering","duration":"2-3 weeks"},{"stage":"Fruiting","duration":"3-4 weeks per flush"},{"stage":"Harvest","duration":"70-90 days from transplant, ongoing"}]',
 '[{"name":"Anthracnose (fruit rot)","symptoms":"Sunken dark lesions on ripe fruit.","prevention":"Use clean seed, mulch, copper sprays."},{"name":"Bacterial wilt","symptoms":"Sudden wilting, no yellowing.","prevention":"Crop rotation, raised beds, resistant varieties."},{"name":"Thrips & mites","symptoms":"Curled leaves, silvery scars.","prevention":"Neem oil, sticky traps."}]'),
('Rice','Warm 20-35°C; flooded paddy or lowland; clay-loam that holds water; full sun.',
 '[{"stage":"Soil Preparation","duration":"Puddling 1-2 weeks"},{"stage":"Seed/Planting","duration":"Nursery"},{"stage":"Germination","duration":"5-10 days"},{"stage":"Transplant","duration":"20-30 days after sowing"},{"stage":"Vegetative","duration":"30-45 days (tillering)"},{"stage":"Flowering","duration":"7-10 days"},{"stage":"Fruiting","duration":"Grain filling 25-35 days"},{"stage":"Harvest","duration":"110-140 days total"}]',
 '[{"name":"Rice blast","symptoms":"Diamond lesions on leaves; neck rot at panicle.","prevention":"Balanced N fertilizer, resistant varieties, tricyclazole."},{"name":"Bacterial leaf blight","symptoms":"Yellow-white streaks from leaf tips.","prevention":"Avoid excess N, use clean seed."},{"name":"Brown planthopper","symptoms":"Hopperburn — patches of dry plants.","prevention":"Resistant varieties, avoid over-spraying pesticides that kill predators."}]'),
('Kampot Pepper','Tropical monsoon; deep red lateritic soils; support poles/trees for vines; partial shade; 25-30°C.',
 '[{"stage":"Soil Preparation","duration":"3-4 weeks"},{"stage":"Seed/Planting","duration":"Cuttings from mother vine"},{"stage":"Transplant","duration":"Rooted cuttings 2-3 months"},{"stage":"Vegetative","duration":"2-3 years training on pole"},{"stage":"Flowering","duration":"April-May"},{"stage":"Fruiting","duration":"6-8 months from flowering"},{"stage":"Harvest","duration":"Year 3 onward, annually Feb-May"}]',
 '[{"name":"Foot rot (Phytophthora)","symptoms":"Wilting, blackened collar, defoliation.","prevention":"Well-drained mounds, Trichoderma, copper drenches, avoid trunk wounds."},{"name":"Slow decline (nematodes)","symptoms":"Progressive yellowing and yield loss.","prevention":"Organic mulch, marigold intercrop, healthy planting stock."},{"name":"Pollu beetle","symptoms":"Hollow berries, spikes dry out.","prevention":"Neem sprays at berry set; field sanitation."}]'),
('Papaya','Warm 22-32°C; well-drained sandy loam; full sun; sensitive to frost and waterlogging.',
 '[{"stage":"Soil Preparation","duration":"1-2 weeks"},{"stage":"Seed/Planting","duration":"Nursery"},{"stage":"Germination","duration":"2-3 weeks"},{"stage":"Transplant","duration":"6-8 weeks after sowing"},{"stage":"Vegetative","duration":"4-6 months"},{"stage":"Flowering","duration":"5-8 months from planting"},{"stage":"Fruiting","duration":"9-11 months"},{"stage":"Harvest","duration":"From 9 months, continuous ~2 years"}]',
 '[{"name":"Papaya ringspot virus","symptoms":"Mosaic leaves, ring spots on fruit, stunted growth.","prevention":"Rogue infected plants, control aphid vectors, use tolerant varieties."},{"name":"Phytophthora root/foot rot","symptoms":"Wilting, root/collar rot.","prevention":"Raised beds, good drainage, avoid overwatering."},{"name":"Powdery mildew","symptoms":"White patches on leaves.","prevention":"Sulfur sprays, airflow."}]'),
('Jackfruit','Hot humid 25-30°C; deep well-drained loam; long-lived tree; full sun; drought-tolerant once established.',
 '[{"stage":"Soil Preparation","duration":"2-4 weeks"},{"stage":"Seed/Planting","duration":"Year 0"},{"stage":"Germination","duration":"3-6 weeks"},{"stage":"Transplant","duration":"6-12 months"},{"stage":"Vegetative","duration":"3-4 years"},{"stage":"Flowering","duration":"1-2 months"},{"stage":"Fruiting","duration":"4-8 months per fruit"},{"stage":"Harvest","duration":"Year 4-5 onward"}]',
 '[{"name":"Fruit rot (Rhizopus)","symptoms":"Soft blackening of young fruit.","prevention":"Sanitation, remove mummified fruit, copper sprays."},{"name":"Pink disease","symptoms":"Pink fungal crust on branches, dieback.","prevention":"Prune infected branches, Bordeaux paste."},{"name":"Shoot borer","symptoms":"Wilting shoots with entry holes.","prevention":"Prune, insecticidal drench."}]'),
('Dragon Fruit','25-35°C; sandy well-drained soil; needs sturdy trellis; full sun; drought tolerant.',
 '[{"stage":"Soil Preparation","duration":"1-2 weeks"},{"stage":"Seed/Planting","duration":"Cuttings"},{"stage":"Transplant","duration":"Rooted cutting 2-4 weeks"},{"stage":"Vegetative","duration":"9-12 months to first flowers"},{"stage":"Flowering","duration":"Night bloom, batches May-Oct"},{"stage":"Fruiting","duration":"30-45 days from flower"},{"stage":"Harvest","duration":"Multiple flushes each season from year 2"}]',
 '[{"name":"Stem canker (Neoscytalidium)","symptoms":"Orange lesions on stems that rot.","prevention":"Remove infected stems, copper/mancozeb sprays, sanitize tools."},{"name":"Anthracnose","symptoms":"Sunken spots on fruit and stems.","prevention":"Airflow via pruning, fungicide rotation."},{"name":"Mealybugs and ants","symptoms":"Sticky honeydew, sooty mold.","prevention":"Neem/soap spray, control ants."}]'),
('Coconut','Coastal tropical 27-30°C; sandy loam; high humidity; salt-tolerant; full sun.',
 '[{"stage":"Soil Preparation","duration":"2-4 weeks pit prep"},{"stage":"Seed/Planting","duration":"Nut planting in nursery"},{"stage":"Germination","duration":"3-6 months"},{"stage":"Transplant","duration":"Seedling 8-12 months old"},{"stage":"Vegetative","duration":"5-7 years"},{"stage":"Flowering","duration":"Continuous once bearing"},{"stage":"Fruiting","duration":"11-12 months per nut"},{"stage":"Harvest","duration":"Year 6-8 onward, monthly"}]',
 '[{"name":"Bud rot (Phytophthora)","symptoms":"Wilting spear leaf, foul rot at crown.","prevention":"Copper fungicide in crown, remove infected palms."},{"name":"Rhinoceros beetle","symptoms":"V-shaped cuts on fronds, bored crown.","prevention":"Pheromone traps, compost heap hygiene."},{"name":"Lethal yellowing","symptoms":"Nut drop, yellowing fronds, flower necrosis.","prevention":"Tolerant varieties, remove infected palms, insecticide against leafhopper vectors."}]');
