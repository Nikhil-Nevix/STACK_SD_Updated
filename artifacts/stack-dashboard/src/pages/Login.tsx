import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginForm) => {
    login.mutate(
      { data: { email: values.email, password: values.password } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setLocation("/dashboard");
        },
        onError: () => {
          toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex bg-[#1B3A6B]">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-[#F47920] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">STACK</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            AI-Powered IT<br />Service Desk
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Automate resolution, reduce manual effort, and deliver faster IT support with intelligent workflows.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-[#0097A7] flex items-center justify-center text-white font-bold">85%</div>
            <div>
              <div className="font-semibold">Auto-Resolution Rate</div>
              <div className="text-sm text-blue-200">Tickets resolved without human intervention</div>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-[#F47920] flex items-center justify-center text-white font-bold text-xs">SLA</div>
            <div>
              <div className="font-semibold">97.3% SLA Compliance</div>
              <div className="text-sm text-blue-200">Consistently meeting service level agreements</div>
            </div>
          </div>
        </div>
        <p className="text-blue-300 text-sm">
          Jade Global Software Pvt Ltd &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-[#1B3A6B] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1B3A6B]">STACK</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="text-gray-500 mt-1">Jade Global IT Service Desk</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="you@jgsl.com"
                        data-testid="input-email"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-password"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white font-semibold"
                disabled={login.isPending}
                data-testid="button-login"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Use <span className="font-mono bg-gray-100 px-1 rounded">admin@jgsl.com</span> with any password
          </p>
        </div>
      </div>
    </div>
  );
}
