import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog"
import { useCreateService } from "../api/use-admin"
import { useState } from "react"

const serviceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  min_cpu_cores: z.coerce.number().min(1, "At least 1 core"),
  min_ram_mb: z.coerce.number().min(128, "At least 128MB"),
  min_storage_gb: z.coerce.number().min(1, "At least 1GB"),
})

type ServiceFormValues = z.infer<typeof serviceSchema>

export function ServiceDialog() {
  const [open, setOpen] = useState(false)
  const { mutate: createService, isPending } = useCreateService()
  
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      category: "other",
      min_cpu_cores: 1,
      min_ram_mb: 512,
      min_storage_gb: 10,
    },
  })

  function onSubmit(data: ServiceFormValues) {
    createService({
        name: data.name,
        description: data.description,
        category: data.category as any, // Cast if needed or use valid category
        requirements: {
            min_cpu_cores: data.min_cpu_cores,
            min_ram_mb: data.min_ram_mb,
            min_storage_gb: data.min_storage_gb
        } as any
    }, {
      onSuccess: () => {
        setOpen(false)
        form.reset()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Service</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Service</DialogTitle>
          <DialogDescription>
            Create a new service template for the catalog.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" className="col-span-3" {...form.register("name")} />
          </div>
          {form.formState.errors.name && (
              <p className="text-destructive text-xs text-right">{form.formState.errors.name.message}</p>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Category</Label>
            <Input id="category" className="col-span-3" {...form.register("category")} /> 
            {/* Should be Select, but using Input for speed unless I make Select component */}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Desc</Label>
            <Input id="description" className="col-span-3" {...form.register("description")} />
          </div>
          
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cpu" className="text-right">CPU</Label>
            <Input id="cpu" type="number" className="col-span-3" {...form.register("min_cpu_cores")} />
          </div>
          
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ram" className="text-right">RAM (MB)</Label>
            <Input id="ram" type="number" className="col-span-3" {...form.register("min_ram_mb")} />
          </div>

           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="storage" className="text-right">Disk (GB)</Label>
            <Input id="storage" type="number" className="col-span-3" {...form.register("min_storage_gb")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
