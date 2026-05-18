import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
        // Error boundary intentionally keeps user-facing recovery friendly.
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-serif font-bold mb-2">Something went wrong. Please refresh.</h1>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        We apologize for the inconvenience. The application encountered an unexpected error.
                    </p>
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                        >
                            Reload Page
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => window.location.href = '/'}
                        >
                            Go Home
                        </Button>
                    </div>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre className="mt-8 p-4 bg-muted rounded-lg text-xs text-left overflow-auto max-w-2xl w-full">
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
