"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { goeyToast as toast } from "@/components/ui/goey-toaster";
import { Save, User, Building2, Stethoscope, Hash } from "lucide-react";

export default function SettingsPage() {
  const { profile, setProfile, fetchProfile, saveProfile } = useStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveProfile();
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center px-6 py-4 gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Manage your doctor profile and preferences</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 w-full max-w-4xl">
        <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Profile Information</h2>
              <p className="text-sm text-muted-foreground">Update your professional details</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Name (Read-only as it comes from Auth usually) */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="name"
                  value={profile.name}
                  disabled
                  className="bg-muted/50 border-border/50"
                  title="Name is managed via your account settings"
                />
              </div>

              {/* Age */}
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" /> Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="e.g. 45"
                  value={profile.age}
                  onChange={(e) => setProfile({ age: e.target.value })}
                  className="bg-background border-border focus:ring-primary/20"
                />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-muted-foreground" /> Department
                </Label>
                <Input
                  id="department"
                  placeholder="e.g. Endocrinology"
                  value={profile.department}
                  onChange={(e) => setProfile({ department: e.target.value })}
                  className="bg-background border-border focus:ring-primary/20"
                />
              </div>

              {/* Hospital */}
              <div className="space-y-2">
                <Label htmlFor="hospital" className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" /> Hospital / Clinic
                </Label>
                <Input
                  id="hospital"
                  placeholder="e.g. City General Hospital"
                  value={profile.hospital}
                  onChange={(e) => setProfile({ hospital: e.target.value })}
                  className="bg-background border-border focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button type="submit" disabled={loading} className="gap-2 px-6 shadow-md shadow-primary/20">
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
