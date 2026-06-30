import NextAuth, { AuthOptions } from "next-auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/features/shared/lib/db";
import bcrypt from "bcrypt";

type AppToken = JWT & {
  id?: string;
  role?: string;
};

type AppSessionUser = Session["user"] & {
  id?: string;
  role?: string;
};

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("This account has been deactivated");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const appToken = token as AppToken;
      if (user) {
        appToken.id = user.id;
        appToken.role = "role" in user ? String(user.role) : undefined;
      }
      return appToken;
    },
    async session({ session, token }) {
      if (session.user) {
        const appUser = session.user as AppSessionUser;
        const appToken = token as AppToken;
        appUser.id = appToken.id;
        appUser.role = appToken.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
