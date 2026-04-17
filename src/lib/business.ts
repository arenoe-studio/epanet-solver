export type BusinessInfo = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
};

export function getBusinessInfo(): BusinessInfo {
  return {
    name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "EPANET Solver",
    email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "support@epanet-solver.com",
    phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE,
    address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS
  };
}

