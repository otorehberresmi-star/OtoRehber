import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../contexts/ThemeContext";
import {
  getCatalogBrands,
  getCatalogEngines,
  getCatalogModels,
  getCatalogVariants,
  normalizeCatalogText,
  VehicleCatalogSelection,
} from "../utils/vehicleCatalog";

export interface FilterState {
  markalar: string[];
  modeller: string[];
  motorGruplari: string[];
  donanimlar: string[];
  yakitTipleri: string[];
  vitesTipleri: string[];
  yilMin: string;
  yilMax: string;
  kmMin: string;
  kmMax: string;
  renkler: string[];
  cekisTipleri: string[];
}

export const defaultFilters: FilterState = {
  markalar: [],
  modeller: [],
  motorGruplari: [],
  donanimlar: [],
  yakitTipleri: [],
  vitesTipleri: [],
  yilMin: "",
  yilMax: "",
  kmMin: "",
  kmMax: "",
  renkler: [],
  cekisTipleri: [],
};

type Step = "brand" | "model" | "engine" | "variant";
type Option = {
  key: string;
  label: string;
  subtitle?: string;
  selection?: VehicleCatalogSelection;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

export default function FilterSheet({ visible, onClose, onApply }: Props) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("brand");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [engine, setEngine] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const safeFilters: FilterState = { ...defaultFilters, ...filters };

  const reset = () => {
    setStep("brand");
    setBrand("");
    setModel("");
    setEngine("");
    setSearch("");
    setFilters(defaultFilters);
  };

  const close = () => {
    setSearch("");
    onClose();
  };

  const goBack = () => {
    setSearch("");
    if (step === "variant") {
      setStep("engine");
      setEngine("");
      setFilters((current) => ({
        ...current,
        donanimlar: [],
        vitesTipleri: [],
      }));
    } else if (step === "engine") {
      setStep("model");
      setModel("");
      setFilters((current) => ({
        ...current,
        motorGruplari: [],
        donanimlar: [],
        yakitTipleri: [],
        vitesTipleri: [],
      }));
    } else if (step === "model") {
      setStep("brand");
      setBrand("");
      setFilters(defaultFilters);
    } else {
      close();
    }
  };

  const options = useMemo<Option[]>(() => {
    if (step === "brand") {
      return getCatalogBrands().map((label) => ({ key: label, label }));
    }
    if (step === "model") {
      return getCatalogModels(brand).map((label) => ({ key: label, label }));
    }
    if (step === "engine") {
      return getCatalogEngines(brand, model).map((label) => ({
        key: label,
        label,
      }));
    }
    return getCatalogVariants(brand, model, engine).map((selection) => ({
      key: [
        selection.sourceRecordId,
        selection.engineGroup,
        selection.trim,
        selection.transmission,
      ].join("|"),
      label: selection.trim,
      subtitle: `${selection.engineGroup} · ${selection.fuelType} · ${selection.transmission}`,
      selection,
    }));
  }, [brand, engine, model, step]);

  const filteredOptions = useMemo(() => {
    const query = normalizeCatalogText(search);
    if (!query) return options;
    return options.filter((item) =>
      normalizeCatalogText(`${item.label} ${item.subtitle || ""}`).includes(
        query,
      ),
    );
  }, [options, search]);

  const stepTitle =
    step === "brand"
      ? "Marka Seç"
      : step === "model"
        ? "Model Seç"
        : step === "engine"
          ? "Motor ve Yakıt Seç"
          : "Donanım Seç";
  const path = [brand, model, engine].filter(Boolean).join("  ›  ");
  const allOptionLabel =
    step === "brand"
      ? "Tüm araçları göster"
      : step === "model"
        ? `${brand} markasının tüm modellerini göster`
        : step === "engine"
          ? `${model} modelinin tüm motorlarını göster`
          : "Tüm donanımları göster";

  const applyCurrentFilters = () => {
    onApply(safeFilters);
    onClose();
  };

  const selectOption = (item: Option) => {
    setSearch("");
    if (step === "brand") {
      setBrand(item.label);
      setModel("");
      setEngine("");
      setFilters({
        ...defaultFilters,
        markalar: [item.label],
      });
      setStep("model");
    } else if (step === "model") {
      setModel(item.label);
      setEngine("");
      setFilters((current) => ({
        ...defaultFilters,
        markalar: current.markalar,
        modeller: [item.label],
      }));
      setStep("engine");
    } else if (step === "engine") {
      setEngine(item.label);
      const selection = getCatalogVariants(brand, model, item.label)[0];
      setFilters((current) => ({
        ...defaultFilters,
        markalar: current.markalar,
        modeller: current.modeller,
        motorGruplari: selection?.engineGroup ? [selection.engineGroup] : [],
        yakitTipleri: selection?.fuelType ? [selection.fuelType] : [],
      }));
      setStep("variant");
    } else if (item.selection) {
      const selection = item.selection;
      setFilters({
        ...defaultFilters,
        markalar: [selection.brand],
        modeller: [selection.model],
        motorGruplari: [selection.engineGroup],
        donanimlar: [selection.trim],
        yakitTipleri: [selection.fuelType],
        vitesTipleri: [selection.transmission],
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={goBack}
    >
      <Pressable style={s.overlay} onPress={close} />
      <KeyboardAvoidingView
        style={s.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
      >
      <View
        style={[
          s.sheet,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={[s.handle, { backgroundColor: palette.border }]} />
        <View style={[s.header, { borderBottomColor: palette.border }]}>
          <TouchableOpacity style={s.iconBtn} onPress={goBack}>
            <FontAwesome6
              name={step === "brand" ? "xmark" : "arrow-left"}
              size={17}
              color={palette.text}
            />
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.eyebrow}>Detaylı Filtre</Text>
            <Text style={[s.title, { color: palette.text }]}>{stepTitle}</Text>
            {path ? (
              <Text style={[s.path, { color: palette.muted }]} numberOfLines={1}>
                {path}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={reset}>
            <Text style={s.resetText}>Sil</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            s.searchBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <FontAwesome6 name="magnifying-glass" size={14} color={palette.muted} />
          <TextInput
            style={[s.searchInput, { color: palette.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder={`${stepTitle.replace(" Seç", "")} ara...`}
            placeholderTextColor={palette.muted}
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <FontAwesome6 name="xmark" size={14} color={palette.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <TouchableOpacity
              style={[
                s.allOption,
                { backgroundColor: palette.card, borderColor: Colors.orange },
              ]}
              onPress={applyCurrentFilters}
              activeOpacity={0.82}
            >
              <View style={s.allOptionIcon}>
                <FontAwesome6 name="list" size={14} color={Colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.allOptionTitle}>{allOptionLabel}</Text>
                <Text style={[s.allOptionSubtitle, { color: palette.muted }]}>
                  Daha fazla ayrıntı seçmeden sonuçları görüntüle
                </Text>
              </View>
              <FontAwesome6
                name="arrow-right"
                size={13}
                color={Colors.orange}
              />
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <Text style={[s.emptyText, { color: palette.muted }]}>
              Bu adım için sonuç bulunamadı.
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected =
              step === "variant" &&
              item.selection?.trim === safeFilters.donanimlar[0] &&
              item.selection?.engineGroup === safeFilters.motorGruplari[0];
            return (
              <TouchableOpacity
                style={[s.item, { borderBottomColor: palette.border }]}
                onPress={() => selectOption(item)}
                activeOpacity={0.82}
              >
                <View style={[s.itemIcon, { backgroundColor: palette.card }]}>
                  <FontAwesome6
                    name={
                      step === "brand"
                        ? "copyright"
                        : step === "model"
                          ? "car-side"
                          : step === "engine"
                            ? "gears"
                            : "list-check"
                    }
                    size={14}
                    color={Colors.orange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.itemLabel,
                      { color: isSelected ? Colors.orange : palette.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text style={[s.itemSubtitle, { color: palette.muted }]}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <FontAwesome6
                  name={isSelected ? "circle-check" : "chevron-right"}
                  size={14}
                  color={isSelected ? Colors.orange : palette.muted}
                  solid={isSelected}
                />
              </TouchableOpacity>
            );
          }}
        />

        <View style={[s.footer, { borderTopColor: palette.border }]}>
          <TouchableOpacity
            style={s.applyBtn}
            onPress={applyCurrentFilters}
          >
            <Text style={s.applyText}>Seçilen Seviyede Sonuçları Göster</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, alignItems: "center" },
  eyebrow: {
    color: Colors.orange,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  path: { fontSize: 11, fontWeight: "600", marginTop: 3, maxWidth: "100%" },
  resetText: { color: Colors.orange, fontSize: 12, fontWeight: "800" },
  searchBox: {
    marginHorizontal: 18,
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  list: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  allOption: {
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  allOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  allOptionTitle: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: "900",
  },
  allOptionSubtitle: { fontSize: 10, fontWeight: "600", marginTop: 3 },
  emptyText: { textAlign: "center", marginTop: 42, fontSize: 13 },
  item: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: { fontSize: 14, fontWeight: "800" },
  itemSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  applyBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  applyText: { color: Colors.white, fontSize: 14, fontWeight: "900" },
});
