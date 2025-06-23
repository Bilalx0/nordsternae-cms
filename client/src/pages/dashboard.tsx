import { useState, useEffect } from "react";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { AuthContext } from "@/context/AuthContext";
import { StatsCard } from "@/components/dashboard/stats-card.jsx";
import { RecentEnquiries } from "@/components/dashboard/recent-enquiries.jsx";
import { FeaturedProperties } from "@/components/dashboard/featured-properties.jsx";
import { useQuery } from "@tanstack/react-query";
import { 
  Building, 
  Inbox, 
  Users, 
  Newspaper,
  TrendingUp,
  Calendar
} from "lucide-react";
import { DashboardStats } from "@/types/index.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.jsx";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const queryClient = useQueryClient();
  const { data: properties = [] } = useQuery({ 
    queryKey: ['/api/properties'], 
  });
  
  const { data: enquiries = [] } = useQuery({ 
    queryKey: ['/api/enquiries'], 
  });
  
  const { data: agents = [] } = useQuery({ 
    queryKey: ['/api/agents'], 
  });
  
  const { data: articles = [] } = useQuery({ 
    queryKey: ['/api/articles'], 
  });

  const stats: DashboardStats = {
    totalProperties: Array.isArray(properties) ? properties.length : 0,
    totalEnquiries: enquiries.length,
    totalAgents: agents.length,
    totalArticles: articles.length,
    recentEnquiries: enquiries.slice(0, 5),
    featuredProperties: properties.filter((p: any) => p.isFeatured).slice(0, 5)
  };

  return (
    <DashLayout
      title="Dashboard"
      description="Welcome to the Nordstern admin dashboard"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Properties"
          value={stats.totalProperties}
          description="Active property listings"
          icon={<Building className="h-8 w-8 text-primary" />}
        />
        <StatsCard
          title="Enquiries"
          value={stats.totalEnquiries}
          description="Client enquiries"
          icon={<Inbox className="h-8 w-8 text-primary" />}
        />
        <StatsCard
          title="Agents"
          value={stats.totalAgents}
          description="Property advisors"
          icon={<Users className="h-8 w-8 text-primary" />}
        />
        <StatsCard
          title="Articles"
          value={stats.totalArticles}
          description="Blog posts & news"
          icon={<Newspaper className="h-8 w-8 text-primary" />}
        />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Enquiries</CardTitle>
            <CardDescription>Latest client inquiries and messages</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentEnquiries enquiries={stats.recentEnquiries} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Featured Properties</CardTitle>
            <CardDescription>Highlighted property listings</CardDescription>
          </CardHeader>
          <CardContent>
            <FeaturedProperties properties={stats.featuredProperties} />
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Performance Overview
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Dubai Real Estate Market</div>
                  <p className="text-xs text-muted-foreground">
                    Monitor key property trends and market performance
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Upcoming Developments
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Palm Jebel Ali</div>
                  <p className="text-xs text-muted-foreground">
                    Launch dates and project timelines for new developments
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Website Traffic
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+12.5%</div>
                  <p className="text-xs text-muted-foreground">
                    Increase in visitor engagement this month
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Detailed performance metrics and visitor insights
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-96 flex items-center justify-center border border-dashed rounded-lg">
                  <p className="text-muted-foreground">Analytics data will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest actions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full p-1 bg-green-100">
                      <div className="rounded-full p-1 bg-green-200">
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">New agent added</p>
                      <p className="text-sm text-muted-foreground">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="rounded-full p-1 bg-blue-100">
                      <div className="rounded-full p-1 bg-blue-200">
                        <Building className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">Property updated</p>
                      <p className="text-sm text-muted-foreground">15 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="rounded-full p-1 bg-amber-100">
                      <div className="rounded-full p-1 bg-amber-200">
                        <Inbox className="h-4 w-4 text-amber-600" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">New enquiry received</p>
                      <p className="text-sm text-muted-foreground">1 hour ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashLayout>
  );
}
