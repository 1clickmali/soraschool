"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Boxes, PackagePlus, Plus, Receipt, RefreshCw, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { downloadProtectedFile, schoolApi, type Product, type ProductCategory } from "@/lib/school-api";
import { cn, formatCurrency } from "@/lib/utils";

const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-colors text-sm";
const labelCls = "text-xs font-medium text-gray-400 mb-1.5 block";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saleModalProduct, setSaleModalProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    code: "",
    name: "",
    categoryId: "",
    photoUrl: "",
    purchasePrice: "0",
    salePrice: "",
    quantity: "0",
    lowStockAlert: "5",
  });
  const [stockForm, setStockForm] = useState({ productId: "", quantity: "", unitPrice: "", reason: "Approvisionnement" });
  const [saleForm, setSaleForm] = useState({ productId: "", quantity: "1" });

  const load = async () => {
    setLoading(true);
    const [productsRes, categoriesRes] = await Promise.all([
      schoolApi.shopProducts(),
      schoolApi.shopCategories(),
    ]);
    const nextProducts = productsRes.data?.products || [];
    setProducts(nextProducts);
    setCategories(categoriesRes.data?.categories || []);
    setStockForm((prev) => ({ ...prev, productId: prev.productId || nextProducts[0]?.id || "" }));
    setSaleForm((prev) => ({ ...prev, productId: prev.productId || nextProducts[0]?.id || "" }));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.isActive);
    const lowStock = activeProducts.filter((product) => product.quantity <= product.lowStockAlert);
    const stockValue = activeProducts.reduce((sum, product) => sum + product.quantity * product.purchasePrice, 0);
    const salesValue = activeProducts.reduce((sum, product) => sum + product.quantity * product.salePrice, 0);
    return { activeProducts, lowStock, stockValue, salesValue };
  }, [products]);

  const createProduct = async () => {
    if (!productForm.code.trim() || !productForm.name.trim() || !productForm.salePrice) {
      setError("Code, nom et prix de vente sont obligatoires.");
      return;
    }
    setSavingProduct(true);
    setError(null);
    const { error: err } = await schoolApi.createShopProduct({
      code: productForm.code.trim(),
      name: productForm.name.trim(),
      categoryId: productForm.categoryId || undefined,
      photoUrl: productForm.photoUrl || undefined,
      purchasePrice: Number(productForm.purchasePrice || 0),
      salePrice: Number(productForm.salePrice),
      quantity: Number(productForm.quantity || 0),
      lowStockAlert: Number(productForm.lowStockAlert || 5),
    });
    setSavingProduct(false);
    if (err) {
      setError(err);
      return;
    }
    setProductForm({ code: "", name: "", categoryId: "", photoUrl: "", purchasePrice: "0", salePrice: "", quantity: "0", lowStockAlert: "5" });
    load();
  };

  const restock = async () => {
    if (!stockForm.productId || !stockForm.quantity) {
      setError("Choisissez un produit et une quantité.");
      return;
    }
    setSavingStock(true);
    setError(null);
    const { error: err } = await schoolApi.createStockMovement({
      productId: stockForm.productId,
      type: "IN",
      quantity: Number(stockForm.quantity),
      unitPrice: stockForm.unitPrice ? Number(stockForm.unitPrice) : undefined,
      reason: stockForm.reason || "Approvisionnement",
    });
    setSavingStock(false);
    if (err) {
      setError(err);
      return;
    }
    setStockForm((prev) => ({ ...prev, quantity: "", unitPrice: "", reason: "Approvisionnement" }));
    load();
  };

  const sellProduct = async () => {
    if (!saleForm.productId || !saleForm.quantity) {
      setError("Choisissez un produit et une quantité à vendre.");
      return;
    }
    const quantity = Number(saleForm.quantity);
    if (!quantity || quantity <= 0) {
      setError("Quantité de vente invalide.");
      return;
    }
    setSavingSale(true);
    setError(null);
    const { data, error: err } = await schoolApi.createShopSale({
      items: [{ productId: saleForm.productId, quantity }],
    });
    setSavingSale(false);
    if (err) {
      setError(err);
      return;
    }
    if (data?.pdfs?.receipt) {
      const pdfError = await downloadProtectedFile(data.pdfs.receipt, `recu-boutique-${data.sale.number}.pdf`);
      if (pdfError) setError(pdfError);
    }
    setSaleForm((prev) => ({ ...prev, quantity: "1" }));
    setSaleModalProduct(null);
    load();
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Stock & fournitures</h1>
          <p className="text-gray-400 text-sm mt-0.5">Produits, approvisionnements, alertes de rupture</p>
        </div>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Actualiser
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Produits actifs", value: stats.activeProducts.length, icon: ShoppingBag, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Alertes stock", value: stats.lowStock.length, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Valeur achat", value: formatCurrency(stats.stockValue), icon: Boxes, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Valeur vente", value: formatCurrency(stats.salesValue), icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <p className="text-xl font-bold text-white font-heading">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Inventaire boutique</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Produit", "Catégorie", "Stock", "Alerte", "Achat", "Vente", "Action"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <ShoppingBag className="w-11 h-11 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Aucun produit en boutique</p>
                      <p className="text-gray-600 text-sm mt-1">Ajoutez votre premier article dans le formulaire.</p>
                    </td>
                  </tr>
                ) : products.map((product) => {
                  const low = product.quantity <= product.lowStockAlert;
                  return (
                    <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{product.code}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{product.category?.name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={cn("text-sm font-semibold", low ? "text-red-400" : "text-emerald-400")}>{product.quantity}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{product.lowStockAlert}</td>
                      <td className="px-5 py-3 text-gray-400">{formatCurrency(product.purchasePrice)}</td>
                      <td className="px-5 py-3 text-white font-semibold">{formatCurrency(product.salePrice)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => {
                            setSaleForm({ productId: product.id, quantity: "1" });
                            setSaleModalProduct(product);
                            setError(null);
                          }}
                          disabled={product.quantity <= 0}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Vendre
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Nouveau produit</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Code *</label>
                <input className={inputCls} value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} placeholder="CAH-100P" />
              </div>
              <div>
                <label className={labelCls}>Nom *</label>
                <input className={inputCls} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Cahier 100 pages" />
              </div>
              <div>
                <label className={labelCls}>Catégorie</label>
                <select className={inputCls} value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}>
                  <option value="" className="bg-soraDark">Sans catégorie</option>
                  {categories.map((category) => <option key={category.id} value={category.id} className="bg-soraDark">{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Photo URL</label>
                <input className={inputCls} value={productForm.photoUrl} onChange={(e) => setProductForm({ ...productForm, photoUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prix achat</label>
                  <input type="number" min="0" className={inputCls} value={productForm.purchasePrice} onChange={(e) => setProductForm({ ...productForm, purchasePrice: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Prix vente *</label>
                  <input type="number" min="1" className={inputCls} value={productForm.salePrice} onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Stock initial</label>
                  <input type="number" min="0" className={inputCls} value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Seuil alerte</label>
                  <input type="number" min="0" className={inputCls} value={productForm.lowStockAlert} onChange={(e) => setProductForm({ ...productForm, lowStockAlert: e.target.value })} />
                </div>
              </div>
              <Button className="w-full" loading={savingProduct} icon={<PackagePlus className="w-4 h-4" />} onClick={createProduct}>
                Créer le produit
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Boxes className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Approvisionnement rapide</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Produit</label>
                <select className={inputCls} value={stockForm.productId} onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}>
                  <option value="" className="bg-soraDark">Choisir un produit</option>
                  {products.map((product) => <option key={product.id} value={product.id} className="bg-soraDark">{product.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Quantité</label>
                  <input type="number" min="1" className={inputCls} value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Prix unitaire</label>
                  <input type="number" min="0" className={inputCls} value={stockForm.unitPrice} onChange={(e) => setStockForm({ ...stockForm, unitPrice: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Motif</label>
                <input className={inputCls} value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} />
              </div>
              <Button className="w-full" variant="secondary" loading={savingStock} icon={<RefreshCw className="w-4 h-4" />} onClick={restock}>
                Ajouter au stock
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Vente rapide</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Produit vendu</label>
                <select className={inputCls} value={saleForm.productId} onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value })}>
                  <option value="" className="bg-soraDark">Choisir un produit</option>
                  {products.map((product) => <option key={product.id} value={product.id} className="bg-soraDark">{product.name} ({product.quantity} restant)</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Quantité</label>
                <input type="number" min="1" className={inputCls} value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })} />
              </div>
              <Button className="w-full" loading={savingSale} icon={<Receipt className="w-4 h-4" />} onClick={sellProduct}>
                Valider la vente + reçu
              </Button>
              <p className="text-xs text-gray-600">Le stock est décrémenté et le reçu PDF se télécharge automatiquement.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {saleModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-soraCard p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Vendre un produit</h2>
                <p className="text-xs text-gray-500">{saleModalProduct.name} · {saleModalProduct.quantity} restant</p>
              </div>
              <button onClick={() => setSaleModalProduct(null)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Quantité à vendre</label>
                <input
                  type="number"
                  min="1"
                  max={saleModalProduct.quantity}
                  className={inputCls}
                  value={saleForm.quantity}
                  onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-xs text-gray-500">Total à encaisser</p>
                <p className="text-xl font-bold text-emerald-300">{formatCurrency(saleModalProduct.salePrice * Number(saleForm.quantity || 0))}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSaleModalProduct(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-gray-400 hover:bg-white/[0.04] hover:text-white transition-all">
                  Annuler
                </button>
                <Button className="flex-1" loading={savingSale} icon={<Receipt className="w-4 h-4" />} onClick={sellProduct}>
                  Vendre
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
