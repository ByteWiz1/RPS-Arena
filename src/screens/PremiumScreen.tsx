import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Crown, Check, Sparkles } from 'lucide-react-native';
import {
  usePremiumStore,
  PREMIUM_FEATURES,
  PREMIUM_PLANS,
} from '../store/premiumStore';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

export default function PremiumScreen() {
  const navigation = useNavigation<any>();
  const { activate, isPremium } = usePremiumStore();
  const [selectedPlan, setSelectedPlan] = useState('6month');

  useEffect(() => {
    startMenuMusic();
  }, []);

  const handleSubscribe = () => {
    showAlert(
      'Coming Soon',
      'Real payments will be available soon. For now, you can activate premium in test mode.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate (Test)',
          onPress: () => {
            activate(selectedPlan as any);
            showAlert('Premium Activated!', 'Enjoy all premium features.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    showAlert(
      'Restore Purchases',
      'No purchases found. Real restore will be available when payments are live.'
    );
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <X size={24} color="#8a8a9a" />
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.heroSection}>
            <View style={styles.crownCircle}>
              <Crown size={40} color="#fbbf24" />
            </View>
            <Text style={styles.heroTitle}>COSMIC PREMIUM</Text>
            <Text style={styles.heroSubtitle}>Unlock the full arena</Text>
          </View>

          <View style={styles.featuresCard}>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature.id} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                </View>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
                <Check size={18} color="#4ade80" />
              </View>
            ))}
          </View>

          <Text style={styles.plansTitle}>Choose Your Plan</Text>

          {PREMIUM_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}
              >
                <View style={styles.planLeft}>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <View>
                    <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                      {plan.label}
                    </Text>
                    {plan.savings && <Text style={styles.planSavings}>{plan.savings}</Text>}
                  </View>
                </View>

                <View style={styles.planRight}>
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Sparkles size={10} color="#000000" />
                      <Text style={styles.popularText}>POPULAR</Text>
                    </View>
                  )}
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {plan.price}
                  </Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
            <Crown size={20} color="#ffffff" />
            <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.trialBtn} onPress={handleSubscribe}>
            <Text style={styles.trialBtnText}>Start 7-Day Free Trial</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
            <Text style={styles.restoreBtnText}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>Cancel anytime · Terms · Privacy</Text>

          {isPremium() && (
            <View style={styles.activeBanner}>
              <Crown size={16} color="#fbbf24" />
              <Text style={styles.activeBannerText}>You are currently Premium 👑</Text>
            </View>
          )}
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 56,
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
  heroSection: { alignItems: 'center', paddingVertical: 20 },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fbbf24', letterSpacing: 2 },
  heroSubtitle: { fontSize: 13, color: '#8a8a9a', marginTop: 4 },
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIcon: { fontSize: 16 },
  featureInfo: { flex: 1 },
  featureLabel: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  featureDesc: { fontSize: 10, color: '#8a8a9a', marginTop: 1 },
  plansTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  planCardSelected: { borderColor: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.08)' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3a3a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: '#fbbf24' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fbbf24' },
  planLabel: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  planLabelSelected: { color: '#fbbf24' },
  planSavings: { fontSize: 10, color: '#4ade80', fontWeight: '700', marginTop: 2 },
  planRight: { alignItems: 'flex-end' },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 3,
  },
  popularText: { fontSize: 8, fontWeight: '900', color: '#000000', letterSpacing: 0.5 },
  planPrice: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  planPriceSelected: { color: '#fbbf24' },
  planPeriod: { fontSize: 10, color: '#8a8a9a' },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  subscribeBtnText: { fontSize: 16, fontWeight: '800', color: '#000000' },
  trialBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  trialBtnText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
  restoreBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  restoreBtnText: { fontSize: 12, color: '#8a8a9a', textDecorationLine: 'underline' },
  footerText: { fontSize: 10, color: '#5a5a7a', textAlign: 'center', marginTop: 10 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  activeBannerText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
});