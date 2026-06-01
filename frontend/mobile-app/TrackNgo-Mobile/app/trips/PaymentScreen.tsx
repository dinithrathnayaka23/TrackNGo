import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function PaymentScreen() {
  const router = useRouter();
  const { tripDetails: tripDetailsStr } = useLocalSearchParams<{ tripDetails: string }>();
  const tripDetails = tripDetailsStr ? JSON.parse(tripDetailsStr) : {};
  const [loading, setLoading] = useState(false);
  
  // 🔹 STRIPE: Card State (Simulation)
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const handlePayment = () => {
    // 🔹 DEMO MODE: Move to confirmation immediately
    router.push({ 
      pathname: '/trips/ConfirmScreen', 
      params: { tripDetails: JSON.stringify(tripDetails) } 
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        
        {/* 🔹 UI: HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, marginTop: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>{tripDetails.tripTitle || "Payment"}</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* 🔹 UI: PROGRESS BAR */}
        <View style={{ padding: 16, marginTop: 9 }}>
          <View style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 10 }}>
            <View style={{ width: "75%", height: 6, backgroundColor: "#2563EB", borderRadius: 10 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 9 }}>
            <Text style={{ fontSize: 12, color: "#2563EB" }}>Sent</Text>
            <Text style={{ fontSize: 12, color: "#2563EB" }}>Negotiation</Text>
            <Text style={{ fontSize: 12, color: "#2563EB", fontWeight: "bold" }}>Payment</Text>
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Confirmed</Text>
          </View>
        </View>

        {/* 🔹 UI: ADVANCE PAYMENT CARD */}
        <View style={{ backgroundColor: "white", padding: 14, borderRadius: 12, margin: 16, alignItems: "center", elevation: 2 }}>
          <Text style={{ color: "#6B7280", fontWeight: "bold" }}>Advance Payment</Text>
          <Text style={{ fontSize: 26, fontWeight: "bold", color: "#2563EB", marginVertical: 2 }}>
            LKR {tripDetails.advancePayment?.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Includes all taxes and service fees.</Text>
        </View>

        {/* 🔹 UI: CARD SECTION (Original Look + Simulation) */}
        <View style={{ backgroundColor: "white", padding: 20, borderRadius: 12, marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: "#6B7280", fontWeight: "bold", marginBottom: 16 }}>Credit / Debit Card</Text>
          
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>CARD NUMBER</Text>
            <TextInput
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChangeText={(t) => setCardNumber(t.substring(0, 19))}
              keyboardType="numeric"
              style={{ fontSize: 16, paddingBottom: 8 }}
            />
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginRight: 10 }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>EXPIRY</Text>
              <TextInput
                placeholder="MM/YY"
                value={expiry}
                onChangeText={(t) => setExpiry(t.substring(0, 5))}
                keyboardType="numeric"
                style={{ fontSize: 16, paddingBottom: 8 }}
              />
            </View>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>CVC</Text>
              <TextInput
                placeholder="123"
                value={cvc}
                secureTextEntry
                onChangeText={(t) => setCvc(t.substring(0, 3))}
                keyboardType="numeric"
                style={{ fontSize: 16, paddingBottom: 8 }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={14} color="#635BFF" />
            <Text style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>Secured by </Text>
            <Text style={{ fontSize: 12, color: '#635BFF', fontWeight: 'bold' }}>stripe</Text>
          </View>
        </View>

        {/* 🔹 UI: PAY BUTTON */}
        <TouchableOpacity
          style={{ 
            backgroundColor: "#2563EB", 
            padding: 16, 
            borderRadius: 10, 
            alignItems: "center", 
            margin: 16, 
            marginTop: 40,
            opacity: loading ? 0.7 : 1
          }}
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              Pay & Confirm Booking →
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 1, paddingHorizontal: 12 }}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
          <Text style={{ fontSize: 10, color: "#6B7280", marginLeft: 6 }}>
            Your payment is secure and encrypted.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
